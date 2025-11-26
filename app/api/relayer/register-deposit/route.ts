import { NextRequest, NextResponse } from 'next/server'
import { registerDeposit } from '@/lib/depositTracking'
import { getSwapQuote, ASSETS, getAvailableTokens } from '@/lib/oneClick'
import { generateEthereumWallet } from '@/lib/wallet'

// Convert USDC amount to smallest unit (6 decimals for USDC)
function usdcToSmallestUnit(amount: string): string {
  const numAmount = parseFloat(amount)
  return (numAmount * 1e6).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intentId, intentType, amount, recipient, senderAddress, chain, redirectUrl } = body

    if (!intentId || !intentType || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: intentId, intentType, amount' },
        { status: 400 }
      )
    }

    let depositAddress: string
    let swapId: string | undefined
    let quoteData: any = null

    // Get USDC asset ID based on target chain (for destinationAsset)
    let usdcAsset = ASSETS.USDC_NEAR // Default to NEAR
    if (chain === 'base') {
      usdcAsset = ASSETS.USDC_BASE
    } else if (chain === 'solana') {
      usdcAsset = ASSETS.USDC_SOLANA
    }

    // Use Zcash asset ID from configured ASSETS (for originAsset)
    // From API: nep141:zec.omft.near
    const zcashAsset = ASSETS.ZCASH

    // Create a new Ethereum wallet for receiving the swapped tokens
    // This wallet will be used to sign x402 payment to the original recipient address
    const swapWallet = generateEthereumWallet()
    console.log('Generated swap wallet:', swapWallet.address)
    console.log('Original payment address (x402 recipient):', recipient)

    // Get quote for Zcash → USDC conversion using 1-Click API
    // User deposits Zcash, which gets swapped to USDC on target chain
    // Use the NEW wallet address as recipient (not the original payment address)
    try {
      const quote = await getSwapQuote({
        senderAddress: senderAddress || 'anyone-pay.near',
        recipientAddress: swapWallet.address, // NEW wallet receives the swap
        originAsset: zcashAsset, // Zcash (user deposits this)
        destinationAsset: usdcAsset, // USDC on target chain (Base/Solana/NEAR)
        amount: usdcToSmallestUnit(amount), // Amount in smallest unit (will be converted from Zcash)
        dry: false, // Actual execution, not test
      })

      // Extract deposit address from quote response
      // The response structure may vary - check multiple possible locations
      depositAddress = quote.depositAddress || quote.quote?.depositAddress || quote.address
      if (!depositAddress) {
        console.error('Quote response:', JSON.stringify(quote, null, 2))
        throw new Error('No deposit address found in quote response')
      }

      quoteData = quote
      swapId = depositAddress // Use deposit address as swap ID for status checking
    } catch (error) {
      console.error('Error getting swap quote from 1-Click API:', error)
      return NextResponse.json(
        { 
          error: 'Failed to get quote from 1-Click API', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        },
        { status: 500 }
      )
    }

    // Register deposit tracking
    // Store both: original payment address (for x402) and new wallet (for swap recipient)
    const result = registerDeposit(
      depositAddress,
      intentId,
      amount,
      recipient, // Original payment address from AI (for x402)
      swapId,
      intentType,
        swapWallet.address, // New wallet that receives swap
        swapWallet.privateKey, // Private key for signing x402
        chain, // Target chain
        redirectUrl // Original redirect URL
      )

    return NextResponse.json({
      ...result,
      depositAddress,
      swapId,
      quote: quoteData?.quote,
      quoteWaitingTimeMs: quoteData?.quoteWaitingTimeMs || 3000, // Default 3 seconds
    })
  } catch (error) {
    console.error('Error registering deposit:', error)
    return NextResponse.json(
      { error: 'Failed to register deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

