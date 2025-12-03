// 1-Click API integration based on https://github.com/near-examples/near-intents-examples
// Using official SDK: @defuse-protocol/one-click-sdk-typescript

import { OneClickService, OpenAPI } from '@defuse-protocol/one-click-sdk-typescript'

const ONE_CLICK_JWT = process.env.ONE_CLICK_JWT || ''
const ONE_CLICK_API_URL =  process.env.ONE_CLICK_API_URL || 'https://1click.chaindefuser.com'

// Initialize SDK with base URL and token (if available)
// Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/4-submit-tx-hash-OPTIONAL.ts
OpenAPI.BASE = ONE_CLICK_API_URL
if (ONE_CLICK_JWT) {
  OpenAPI.TOKEN = ONE_CLICK_JWT
}
// Get all available tokens across chains
// The API returns tokens in format: { result: { tokens: [...] } } or { items: [...] }
export async function getAvailableTokens() {
  try {
    const response = await fetch(`${ONE_CLICK_API_URL}/v0/tokens`, {
      headers: ONE_CLICK_JWT ? { Authorization: `Bearer ${ONE_CLICK_JWT}` } : {},
    })
    if (!response.ok) {
      console.warn(`Tokens endpoint returned ${response.status}. Using configured asset IDs.`)
      return []
    }
    const data = await response.json()
    // Handle different response formats:
    // - { result: { tokens: [...] } } - JSON-RPC format
    // - { items: [...] } - REST format
    // - [...] - Direct array
    if (data.result?.tokens) {
      return data.result.tokens
    } else if (data.items) {
      return data.items
    } else if (Array.isArray(data)) {
      return data
    }
    return []
  } catch (error) {
    console.warn('Error fetching tokens (using configured asset IDs):', error)
    return []
  }
}

// Quote request interface matching 1-Click API format
export interface QuoteRequest {
  dry: boolean // Testing mode: true for quote estimation, false for actual execution
  swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT'
  slippageTolerance: number // Basis points (100 = 1.00%)
  originAsset: string // Source token in NEP:contract format
  depositType: 'ORIGIN_CHAIN' | 'INTENTS'
  destinationAsset: string // Target token in NEP:contract format
  amount: string // Amount in token's smallest unit/decimals
  refundTo: string // Address to receive refunds if swap fails
  refundType: 'ORIGIN_CHAIN' | 'INTENTS'
  recipient: string // Final recipient address for swapped tokens
  recipientType: 'DESTINATION_CHAIN' | 'INTENTS'
  deadline: string // ISO format timestamp
  referral?: string
  quoteWaitingTimeMs?: number
  sessionId?: string // Session identifier for tracking
}

// Get swap quote with deposit address (Zcash → USDC)
export async function getSwapQuote(params: {
  senderAddress: string
  recipientAddress: string
  originAsset: string
  destinationAsset: string
  amount: string
  dry?: boolean // false for actual execution
  sessionId?: string // Optional session identifier
}) {
  try {
    // Generate sessionId if not provided
    const sessionId = params.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    const quoteRequest: QuoteRequest = {
      dry: params.dry ?? true, // true for quote estimation, false for actual execution
      swapType: 'EXACT_OUTPUT', // Exact USDC output amount, calculate required Zcash input
      slippageTolerance: 100, // 1% slippage
      originAsset: params.originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: params.destinationAsset,
      amount: params.amount, // This is the Zcash input amount
      refundTo: process.env.REFUND_ZCASH_ADDRESS || params.senderAddress,
      refundType: 'ORIGIN_CHAIN',
      recipient: params.recipientAddress,
      recipientType: 'DESTINATION_CHAIN',
      deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes from now
      referral: 'anyone-pay',
      quoteWaitingTimeMs: 3000,
      sessionId: sessionId, // Session identifier for tracking
    }
    // Use the original QuoteRequest format - API expects originAsset, destinationAsset, etc.
    // Verify sessionId is included
    if (!quoteRequest.sessionId) {
      console.warn('⚠️ sessionId is missing from quoteRequest!')
    }
    console.log('Quote request:', JSON.stringify(quoteRequest, null, 2))
    
    const response = await fetch(`${ONE_CLICK_API_URL}/v0/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ONE_CLICK_JWT ? { Authorization: `Bearer ${ONE_CLICK_JWT}` } : {}),
      },
      body: JSON.stringify(quoteRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
    }

    const data = await response.json()
    
    // Extract sessionId from response if available
    const responseSessionId = data.sessionId || data.quote?.sessionId || data.session_id || data.quote?.session_id
    if (responseSessionId) {
      console.log('Quote response sessionId:', responseSessionId)
    }
    
    return {
      ...data,
      depositAddress: data.depositAddress || data.quote?.depositAddress || data.address,
      swapId: data.swapId || data.id || data.depositAddress,
      sessionId: responseSessionId, // Include sessionId from response if available
    }
  } catch (error) {
    console.error('Error getting swap quote:', error)
    throw error
  }
}

// Check execution status by deposit address
// Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/5-check-status-OPTIONAL.ts
export async function checkSwapStatus(depositAddress: string) {
  try {
    // Use official SDK method
    const status = await OneClickService.getExecutionStatus(depositAddress)
    //console.log('Swap status from 1-Click SDK:', status, depositAddress)
    return status
  } catch (error) {
    console.error('Error checking swap status:', error)
    throw error
  }
}

// Submit transaction hash (optional, speeds up processing)
// Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/4-submit-tx-hash-OPTIONAL.ts
export async function submitTxHash(txHash: string, depositAddress: string) {
  try {
    // Use official SDK method
   const a =  await OneClickService.submitDepositTx({
      txHash,
      depositAddress
    })
    console.log("a",a,txHash,depositAddress)
    console.log(`✅ Transaction hash submitted: ${txHash} for deposit ${depositAddress}`)
    return { success: true, txHash, depositAddress }
  } catch (error) {
    console.error('Error submitting tx hash:', error)
    throw error
  }
}

// Common asset IDs from 1-Click API token list
export const ASSETS = {
  NEAR: 'nep141:wrap.near',
  // USDC on NEAR - using the actual asset ID from API
  USDC_NEAR: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  // USDC on Base - actual asset ID from API (for destinationAsset)
  USDC_BASE: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
  // USDC on Solana - actual asset ID from API
  USDC_SOLANA: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
  // Zcash - using intents_token_id format (nep141:zec.omft.near) for originAsset
  ZCASH: 'nep141:zec.omft.near',
}
