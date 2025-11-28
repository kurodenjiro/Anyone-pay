import { NextRequest, NextResponse } from 'next/server'
import { registerDeposit } from '@/lib/depositTracking'
import { getSwapQuote, ASSETS, getAvailableTokens } from '@/lib/oneClick'
import { generateChainSigWallet } from '@/lib/wallet'

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

    // Get NEAR proxy account and Ethereum address using Chain Signatures
    // This wallet will be used to receive swap and sign x402 payment
    const swapWallet = await generateChainSigWallet()
    console.log('Using NEAR proxy account:', swapWallet.nearAccountId)
    console.log('Generated Ethereum address:', swapWallet.ethAddress)
    console.log('Original payment address (x402 recipient):', recipient)

    // Get quote for Zcash → USDC conversion using 1-Click API
    // User deposits Zcash, which gets swapped to USDC on target chain
    // Use the NEW Ethereum address as recipient (not the original payment address)
    try {
      const quote = await getSwapQuote({
        senderAddress: senderAddress || 'anyone-pay.near',
        recipientAddress: swapWallet.ethAddress, // NEW Ethereum address receives the swap
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
      swapWallet.ethAddress, // Ethereum address from NEAR account
      swapWallet.nearAccountId, // NEAR account ID for Chain Signatures
      chain, // Target chain
      redirectUrl // Original redirect URL
    )

    // Extract Zcash deposit amount from quote
    // The quote shows how much Zcash is needed to get the requested USDC amount
    // We requested EXACT_OUTPUT (USDC amount), so the quote should tell us the input amount (Zcash)
    let zcashAmount: string | undefined = undefined
    
    // Log quote structure for debugging
    console.log('Quote data structure:', JSON.stringify(quoteData, null, 2))
    
    // The quote response structure may vary - check multiple possible locations
    const quoteResponse = quoteData?.quote || quoteData
    
    // Try to find the Zcash amount in various possible locations
    let zcashAmountInSmallestUnit: string | number | undefined
    
    // Check for amountInFormatted (formatted Zcash amount to deposit) - highest priority
    if (quoteResponse?.amountInFormatted) {
      // If it's already formatted, use it directly (remove trailing zeros)
      zcashAmount = quoteResponse.amountInFormatted.toString().replace(/\.?0+$/, '')
      console.log('✅ Found amountInFormatted:', zcashAmount, 'ZEC')
    }
    // Check top level amountInFormatted
    else if (quoteData?.amountInFormatted) {
      zcashAmount = quoteData.amountInFormatted.toString().replace(/\.?0+$/, '')
      console.log('✅ Found top-level amountInFormatted:', zcashAmount, 'ZEC')
    }
    // Check for amountIn (raw amount in smallest unit)
    else if (quoteResponse?.amountIn) {
      zcashAmountInSmallestUnit = quoteResponse.amountIn
      console.log('Found amountIn:', zcashAmountInSmallestUnit)
    }
    // Check for originAmount (amount of origin asset = Zcash)
    else if (quoteResponse?.originAmount) {
      zcashAmountInSmallestUnit = quoteResponse.originAmount
      console.log('Found originAmount:', zcashAmountInSmallestUnit)
    } 
    // Check for inputAmount
    else if (quoteResponse?.inputAmount) {
      zcashAmountInSmallestUnit = quoteResponse.inputAmount
      console.log('Found inputAmount:', zcashAmountInSmallestUnit)
    }
    // Check for fromAmount
    else if (quoteResponse?.fromAmount) {
      zcashAmountInSmallestUnit = quoteResponse.fromAmount
      console.log('Found fromAmount:', zcashAmountInSmallestUnit)
    }
    // Check for estimatedOriginAmount
    else if (quoteResponse?.estimatedOriginAmount) {
      zcashAmountInSmallestUnit = quoteResponse.estimatedOriginAmount
      console.log('Found estimatedOriginAmount:', zcashAmountInSmallestUnit)
    }
    // Check top level originAmount
    else if (quoteData?.originAmount) {
      zcashAmountInSmallestUnit = quoteData.originAmount
      console.log('Found top-level originAmount:', zcashAmountInSmallestUnit)
    }
    
    // Convert from smallest unit (Zcash has 8 decimals) if we found raw amount
    if (zcashAmount === undefined && zcashAmountInSmallestUnit !== undefined) {
      try {
        const zcashInSmallestUnit = BigInt(zcashAmountInSmallestUnit.toString())
        // Convert to number and remove trailing zeros
        const zcashAmountNum = Number(zcashInSmallestUnit) / 1e8
        // Format to remove trailing zeros, but keep up to 8 decimal places if needed
        zcashAmount = zcashAmountNum.toString().replace(/\.?0+$/, '')
        console.log('✅ Extracted Zcash amount from smallest unit:', zcashAmount, 'ZEC')
      } catch (error) {
        console.error('Error converting Zcash amount:', error)
        // If conversion fails, try to calculate from exchange rate or price
        const usdcAmount = parseFloat(amount)
        if (quoteResponse?.rate || quoteResponse?.exchangeRate) {
          try {
            const rate = parseFloat((quoteResponse.rate || quoteResponse.exchangeRate).toString())
            const zcashAmountNum = usdcAmount / rate
            zcashAmount = zcashAmountNum.toString().replace(/\.?0+$/, '')
            console.log('✅ Calculated Zcash amount from rate:', zcashAmount, 'ZEC')
          } catch (rateError) {
            console.error('Error calculating from rate:', rateError)
          }
        } else if (quoteResponse?.price || quoteData?.price) {
          try {
            const zcashPrice = parseFloat((quoteResponse.price || quoteData.price).toString())
            const zcashAmountNum = usdcAmount / zcashPrice
            zcashAmount = zcashAmountNum.toString().replace(/\.?0+$/, '')
            console.log('✅ Calculated Zcash amount from price:', zcashAmount, 'ZEC')
          } catch (priceError) {
            console.error('Error calculating from price:', priceError)
          }
        }
      }
    }
    
    // If we still don't have a Zcash amount, log warning (don't use fallback)
    if (zcashAmount === undefined) {
      console.warn('⚠️ Could not find Zcash amount in quote. Available keys:', Object.keys(quoteResponse || {}))
      console.warn('⚠️ Full quote data:', quoteData)
      // Don't set a fallback - let it be undefined so the frontend can handle it
    }

    return NextResponse.json({
      ...result,
      depositAddress,
      swapId,
      quote: quoteData?.quote,
      quoteWaitingTimeMs: quoteData?.quoteWaitingTimeMs || 3000, // Default 3 seconds
      ...(zcashAmount !== undefined && { zcashAmount }), // Only include if found (amountInFormatted extracted)
    })
  } catch (error) {
    console.error('Error registering deposit:', error)
    return NextResponse.json(
      { error: 'Failed to register deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

