// NEAR AI Cloud integration for prompt analysis
// Based on https://docs.near.ai/cloud/get-started/#quick-setup
// TEMPORARILY using OpenAI for testing
import OpenAI from 'openai'
import { findBestService, PaymentService } from './serviceRegistry'

const NEAR_AI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEAR_AI_API_KEY || ''
// Temporarily using OpenAI instead of NEAR AI Cloud for testing
const NEAR_AI_BASE_URL = process.env.OPENAI_API_KEY 
  ? 'https://api.openai.com/v1'  // OpenAI endpoint
  : 'https://cloud-api.near.ai/v1'  // NEAR AI Cloud endpoint

export interface AnalyzedIntent {
  action: string
  amount: string
  currency: string
  recipient: string
  chain?: string
  needsBridge: boolean
  bridgeFrom?: string
  bridgeTo?: string
  serviceId?: string  // Matched service ID
  serviceName?: string  // Matched service name
  redirectUrl?: string  // Service redirect URL
  receivingAddress?: string  // Payment receiving address
  aiMessage?: string  // AI response when data is incomplete
}

export async function analyzePromptWithNearAI(prompt: string): Promise<AnalyzedIntent> {
  // First, try to match with service registry using semantic search
  // Only returns if similarity is above threshold (0.7 = 70% match)
  const matchedService = await findBestService(prompt, 0.7)
  
  if (matchedService) {
    // If service is found, use its details with direct URL
    return {
      action: 'pay',
      amount: matchedService.amount,
      currency: matchedService.currency,
      recipient: matchedService.url, // Use direct URL
      chain: matchedService.chain,
      needsBridge: true,
      bridgeFrom: 'zcash',
      bridgeTo: matchedService.chain,
      serviceId: matchedService.id,
      serviceName: matchedService.name,
      redirectUrl: matchedService.url, // Direct URL to content
      receivingAddress: matchedService.receivingAddress, // Payment receiving address
    }
  }

  // If no service match, use AI to analyze
  if (!NEAR_AI_API_KEY) {
    // Fallback to simple parsing if no API key
    return parsePromptFallback(prompt)
  }

  try {
    const openai = new OpenAI({
      baseURL: NEAR_AI_BASE_URL,
      apiKey: NEAR_AI_API_KEY,
    })

    // Get available services for context
    const availableServices = await getAllServicesForPrompt()

    const systemPrompt = `You are an AI assistant that analyzes payment intents for Anyone Pay. Extract payment information from user queries.

Available services to match against:
${availableServices}

RULES:
1. If the user query matches a service (similarity > 70%), use that service's complete details (amount, currency, chain, receivingAddress).
2. If the query is a random/incomplete prompt (missing amount, network Base/Solana, or payment address), respond with a natural, friendly "aiMessage" explaining what's needed.
3. For complete payment intents, extract: amount, currency (must be USDC), chain (must be base or solana), and receivingAddress.
4. IMPORTANT: If user mentions USDT, USDT, or any USD-related currency, automatically convert to USDC in your response. The system only supports USDC payments.

REQUIRED FIELDS for complete payment:
- amount: numeric value (e.g., "0.1")
- currency: must be "USDC"
- chain: must be "base" or "solana"
- receivingAddress: valid blockchain address (0x... for Base, or Solana address)

IMPORTANT: You must respond in valid JSON format only. Do not include any text outside the JSON object.

For COMPLETE payment intents (all required fields present), respond with this JSON structure:
{
  "action": "pay",
  "amount": "0.1",
  "currency": "USDC",
  "recipient": "",
  "chain": "base",
  "needsBridge": true,
  "bridgeFrom": "zcash",
  "bridgeTo": "base",
  "receivingAddress": "0x03fBbA1b1A455d028b074D9abC2b23d3EF786943"
}

For INCOMPLETE intents (missing required fields), respond with this JSON structure including aiMessage:
{
  "action": "pay",
  "amount": "",
  "currency": "",
  "recipient": "",
  "chain": "",
  "needsBridge": false,
  "aiMessage": "<missing required fields>"
}

Make the aiMessage natural, friendly, and specific about what's missing. Always respond with valid JSON only.`

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_API_KEY 
        ? 'gpt-4o-mini'  // Use OpenAI model when testing with OpenAI
        : 'deepseek-chat-v3-0324',  // NEAR AI Cloud model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const response = completion.choices[0].message.content
    if (response) {
      const parsed = JSON.parse(response) as AnalyzedIntent
      console.log(parsed)
      // Normalize currency: convert USDT or any USD-related currency to USDC
      const originalCurrency = parsed.currency?.toUpperCase() || ''
      if (originalCurrency && (originalCurrency === 'USDT' || (originalCurrency.includes('USD') && originalCurrency !== 'USDC'))) {
        // Convert to USDC
        parsed.currency = 'USDC'
        // Add AI message explaining the conversion (but don't block payment if data is complete)
        if (!parsed.aiMessage) {
          parsed.aiMessage = `I've converted ${originalCurrency} to USDC since we only support USDC payments.`
        } else if (!parsed.aiMessage.includes('converted')) {
          parsed.aiMessage = `I've converted ${originalCurrency} to USDC since we only support USDC payments. ${parsed.aiMessage}`
        }
      }
      
      // Check if payment data is complete
      const hasCompleteData = !!(
        parsed.amount && 
        parseFloat(parsed.amount) > 0 &&
        parsed.currency === 'USDC' &&
        (parsed.chain === 'base' || parsed.chain === 'solana') &&
        parsed.receivingAddress &&
        parsed.receivingAddress.length > 0
      )
      
      // Keep the aiMessage (including conversion messages) - don't remove it
      // The frontend will handle showing it appropriately even when data is complete
      
        // If incomplete and no aiMessage, generate one
        if (!hasCompleteData && !parsed.aiMessage) {
          const missingFields: string[] = []
          if (!parsed.amount || parseFloat(parsed.amount) <= 0) missingFields.push('the amount in USDC (like 0.1 USDC)')
          if (parsed.currency !== 'USDC') missingFields.push('USDC as the currency')
          if (parsed.chain !== 'base' && parsed.chain !== 'solana') missingFields.push('which network to use (Base or Solana)')
          if (!parsed.receivingAddress || parsed.receivingAddress.length === 0) missingFields.push('the payment address')
          
          // Generate natural, conversational message based on missing fields
          const fieldCount = missingFields.length
          if (fieldCount === 1) {
            parsed.aiMessage = `I need ${missingFields[0]} to process your payment.`
          } else if (fieldCount === 2) {
            parsed.aiMessage = `I need ${missingFields[0]} and ${missingFields[1]} to create this payment.`
          } else {
            const lastField = missingFields.pop()
            parsed.aiMessage = `I need ${missingFields.join(', ')}, and ${lastField} to process your payment.`
          }
        }
      
      return parsed
    }
  } catch (error) {
    console.error('NEAR AI analysis error:', error)
  }

  // Fallback to simple parsing
  const fallback = parsePromptFallback(prompt)
  // Check if fallback has complete data
  const hasCompleteData = !!(
    fallback.amount && 
    parseFloat(fallback.amount) > 0 &&
    fallback.currency === 'USDC' &&
    (fallback.chain === 'base' || fallback.chain === 'solana') &&
    fallback.receivingAddress &&
    fallback.receivingAddress.length > 0
  )
  
  if (!hasCompleteData) {
    const missingFields: string[] = []
    if (!fallback.amount || parseFloat(fallback.amount) <= 0) missingFields.push('the amount in USDC (like 0.1 USDC)')
    if (fallback.chain !== 'base' && fallback.chain !== 'solana') missingFields.push('which network to use (Base or Solana)')
    if (!fallback.receivingAddress || fallback.receivingAddress.length === 0) missingFields.push('the payment address')
    
    if (missingFields.length > 0) {
      const fieldCount = missingFields.length
      if (fieldCount === 1) {
        fallback.aiMessage = `I need ${missingFields[0]} to process your payment.`
      } else if (fieldCount === 2) {
        fallback.aiMessage = `I need ${missingFields[0]} and ${missingFields[1]} to create this payment.`
      } else {
        const lastField = missingFields.pop()
        fallback.aiMessage = `I need ${missingFields.join(', ')}, and ${lastField} to process your payment.`
      }
    } else {
      fallback.aiMessage = "I need a few details to process your payment: the amount in USDC (like 0.1 USDC), which network you want to use (Base or Solana), and the payment address. ?"
    }
  }
  
  return fallback
}

async function getAllServicesForPrompt(): Promise<string> {
  const { getAllServices } = require('./serviceRegistry')
  const services: PaymentService[] = await getAllServices()
  if (services.length === 0) return 'No services available'
  return services.map((s: PaymentService) => 
    `- ${s.name} (keywords: ${s.keywords.join(', ')}) - Amount: ${s.amount} ${s.currency}, Chain: ${s.chain}, URL: ${s.url}`
  ).join('\n')
}

function parsePromptFallback(prompt: string): AnalyzedIntent {
  const lower = prompt.toLowerCase()
  
  // Extract amount
  const amountMatch = prompt.match(/(\d+(?:\.\d+)?)\s*\$?/)
  const amount = amountMatch ? amountMatch[1] : ''
  
  // Extract recipient (domain, address, etc.)
  const domainMatch = prompt.match(/([a-z0-9-]+\.(?:fun|com|org|net|io))/i)
  const recipient = domainMatch ? domainMatch[1] : ''
  
  // Extract receiving address (0x... or Solana address)
  // Match 0x followed by 40 hex chars, or Solana address (32-44 base58 chars)
  const addressMatch = prompt.match(/(0x[a-fA-F0-9]{40,42}|[1-9A-HJ-NP-Za-km-z]{32,44})/)
  const receivingAddress = addressMatch ? addressMatch[1] : ''
  
  // Extract currency (USDT, USDT, USDC) - normalize to USDC
  let currency = 'USDC'
  let currencyConverted = false
  if (lower.includes('usdt')) {
    currency = 'USDC'
    currencyConverted = true
  } else if (lower.includes('usdc')) {
    currency = 'USDC'
  }
  
  // Determine chain from recipient or prompt
  let chain = ''
  if (lower.includes('base')) chain = 'base'
  else if (lower.includes('solana') || lower.includes('.sol')) chain = 'solana'
  else if (lower.includes('near') || lower.includes('.near')) chain = 'near'
  else if (lower.includes('polygon') || lower.includes('matic')) chain = 'polygon'
  else if (lower.includes('arbitrum') || lower.includes('arb')) chain = 'arbitrum'
  
  const result: AnalyzedIntent = {
    action: 'pay',
    amount,
    currency: 'USDC',
    recipient,
    chain,
    needsBridge: chain === 'base' || chain === 'solana',
    bridgeFrom: 'zcash',
    bridgeTo: chain || 'base',
    receivingAddress,
  }
  
  // Add conversion message if currency was converted
  if (currencyConverted) {
    result.aiMessage = `I've converted USDT to USDC since we only support USDC payments.`
  }
  
  return result
}

// Check which chain a domain/content is on
export async function detectChainForDomain(domain: string): Promise<string> {
  // In production, this would query a registry or API
  // For now, use heuristics or default to ethereum
  const domainLower = domain.toLowerCase()
  
  if (domainLower.includes('.near')) return 'near'
  if (domainLower.includes('.sol')) return 'solana'
  
  // Default to ethereum for most domains
  return 'ethereum'
}

