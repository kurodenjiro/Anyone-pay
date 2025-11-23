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
  redirectUrl?: string  // Service redirect URL (generated from resource key)
  resourceKey?: string  // Public Key A (Linkdrop Key) for data drop
  contractId?: string  // Data Drop Smart Contract address
}

export async function analyzePromptWithNearAI(prompt: string): Promise<AnalyzedIntent> {
  // First, try to match with service registry using semantic search
  // Only returns if similarity is above threshold (0.7 = 70% match)
  const matchedService = await findBestService(prompt, 0.7)
  
  if (matchedService) {
    // If service is found, use its details with data drop resource key
    // The redirect URL will be generated from the resource key via Intent Solver
    const redirectUrl = `/intent/${matchedService.resourceKey}`
    
    return {
      action: 'pay',
      amount: matchedService.amount,
      currency: matchedService.currency,
      recipient: matchedService.resourceKey, // Use resource key instead of URL
      chain: matchedService.chain,
      needsBridge: true,
      bridgeFrom: 'zcash',
      bridgeTo: matchedService.chain,
      serviceId: matchedService.id,
      serviceName: matchedService.name,
      redirectUrl: redirectUrl,
      resourceKey: matchedService.resourceKey,
      contractId: matchedService.contractId,
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

    const systemPrompt = `You are an AI assistant that analyzes payment intents. Extract:
1. Action (pay, send, transfer, etc.)
2. Amount and currency
3. Recipient (domain, address, or identifier)
4. Target blockchain (if mentioned or infer from recipient)
5. Whether bridging is needed (if currency differs from target chain)

Available services to match against:
${availableServices}

If the user query matches a service, use that service's details. Otherwise, extract from the query.

Respond in JSON format:
{
  "action": "pay",
  "amount": "0.1",
  "currency": "USD",
  "recipient": "meme-content.fun",
  "chain": "ethereum",
  "needsBridge": true,
  "bridgeFrom": "zcash",
  "bridgeTo": "ethereum"
}`

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
      const parsed = JSON.parse(response)
      return parsed as AnalyzedIntent
    }
  } catch (error) {
    console.error('NEAR AI analysis error:', error)
  }

  // Fallback to simple parsing
  return parsePromptFallback(prompt)
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
  const amount = amountMatch ? amountMatch[1] : '0.1'
  
  // Extract recipient (domain, address, etc.)
  const domainMatch = prompt.match(/([a-z0-9-]+\.(?:fun|com|org|net|io))/i)
  const recipient = domainMatch ? domainMatch[1] : ''
  
  // Determine chain from recipient or prompt
  let chain = 'ethereum' // default
  if (lower.includes('near') || lower.includes('.near')) chain = 'near'
  if (lower.includes('solana') || lower.includes('.sol')) chain = 'solana'
  if (lower.includes('polygon') || lower.includes('matic')) chain = 'polygon'
  if (lower.includes('arbitrum') || lower.includes('arb')) chain = 'arbitrum'
  
  return {
    action: 'pay',
    amount,
    currency: 'USD',
    recipient,
    chain,
    needsBridge: true,
    bridgeFrom: 'zcash',
    bridgeTo: chain,
  }
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

