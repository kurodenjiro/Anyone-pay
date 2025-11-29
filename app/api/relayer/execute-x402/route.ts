import { NextRequest, NextResponse } from 'next/server'
import { getDepositTracking, markDepositConfirmed, updateDepositTracking } from '@/lib/depositTracking'
import { executeX402Payment } from '@/lib/wallet'

/**
 * Execute x402 payment after swap completes
 * Uses the swap wallet to sign and send payment to the original recipient address
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📥 POST /api/relayer/execute-x402 called')
    
    const body = await request.json()
    const { depositAddress } = body

    console.log('Request body:', { depositAddress })

    if (!depositAddress) {
      return NextResponse.json(
        { error: 'Missing required field: depositAddress' },
        { status: 400 }
      )
    }

    const tracking = getDepositTracking(depositAddress)
    if (!tracking) {
      return NextResponse.json(
        { error: 'Deposit tracking not found' },
        { status: 404 }
      )
    }

    if (!tracking.nearAccountId || !tracking.swapWalletAddress || !tracking.redirectUrl || !tracking.chain) {
      return NextResponse.json(
        { error: 'Missing required data for x402 payment' },
        { status: 400 }
      )
    }

    if (tracking.x402Executed) {
      return NextResponse.json({
        success: true,
        message: 'x402 payment already executed',
        redirectUrl: tracking.redirectUrl,
      })
    }

    try {
      // Execute x402 payment: get quote, sign with Chain Signatures, and send to target API
      const paymentResult = await executeX402Payment(
        tracking.nearAccountId, // NEAR account ID for Chain Signatures
        tracking.swapWalletAddress, // Ethereum address from NEAR account
        tracking.redirectUrl, // Target API URL
        tracking.chain
      )

      if (paymentResult.success) {
        // Mark x402 as executed and save signedPayload to DB
        updateDepositTracking(depositAddress, {
          signedPayload: paymentResult.signedPayload,
          x402Executed: true,
          confirmed: true,
          confirmedAt: Date.now()
        })

        // Build redirect URL with signed payload
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const contentUrl = new URL('/content', baseUrl)
        contentUrl.searchParams.set('signedPayload', encodeURIComponent(paymentResult.signedPayload!))
        contentUrl.searchParams.set('address', tracking.swapWalletAddress || '')

        return NextResponse.json({
          success: true,
          signedPayload: paymentResult.signedPayload,
          settlementHash: paymentResult.settlementHash,
          data: paymentResult.data,
          redirectUrl: contentUrl.toString(),
        })
      } else {
        // Build refund URL with signed payload only
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const refundUrl = new URL('/refund', baseUrl)
        // Create a signed payload for refund (contains payment info)
        const refundPayload = JSON.stringify({
          amount: tracking.amount,
          chain: tracking.chain,
          recipient: tracking.recipient,
        })
        const token = Buffer.from(refundPayload).toString('base64')
        refundUrl.searchParams.set('token', token)

        return NextResponse.json({
          success: false,
          error: paymentResult.error,
          redirectUrl: refundUrl.toString(),
        })
      }
    } catch (error) {
      console.error('Error executing x402 payment:', error)
      return NextResponse.json(
        {
          error: 'Failed to execute x402 payment',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in execute-x402:', error)
    return NextResponse.json(
      { error: 'Failed to execute x402 payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

