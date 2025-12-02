import { NextRequest, NextResponse } from 'next/server'
import { getDepositTracking } from '@/lib/depositTracking'
import { checkSwapStatus } from '@/lib/oneClick'

/**
 * Get target API URL and check x402 payment status by deposit address
 * This endpoint verifies that the x402 payment has been executed before returning the content URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const depositAddress = searchParams.get('address') // Deposit address, not swap wallet address

    if (!depositAddress) {
      return NextResponse.json(
        { error: 'Missing required parameter: address (deposit address)' },
        { status: 400 }
      )
    }

    // Look up deposit tracking by deposit address
    const tracking = await getDepositTracking(depositAddress)

    if (!tracking) {
      return NextResponse.json(
        { error: 'Deposit tracking not found for this address' },
        { status: 404 }
      )
    }

    if (!tracking.redirectUrl) {
      return NextResponse.json(
        { error: 'Redirect URL not found for this address' },
        { status: 404 }
      )
    }

    // Extract serviceName from quoteData metadata if available (before any early returns)
    let serviceName: string | undefined = undefined
    if (tracking?.quoteData) {
      const quoteData = typeof tracking.quoteData === 'string' 
        ? JSON.parse(tracking.quoteData) 
        : tracking.quoteData
      serviceName = quoteData?.metadata?.serviceName || 
                    quoteData?.serviceName ||
                    quoteData?.quote?.metadata?.serviceName ||
                    quoteData?.quoteResponse?.metadata?.serviceName
    }

    // Check x402 payment status
    // Verify that the payment has been executed (signedPayload exists in database)
    if (!tracking.signedPayload) {
      return NextResponse.json(
        { 
          error: 'x402 payment not yet executed',
          message: 'Payment is still being processed. Please wait.',
          redirectUrl: tracking.redirectUrl,
          x402Executed: false,
          serviceName, // Include service name even in error response
        },
        { status: 402 } // Payment Required
      )
    }

    // Check swap status to ensure it's SUCCESS
    // Use depositAddress (which is the swapId) to check status
    let swapStatus = 'UNKNOWN'
    try {
      const statusResponse = await checkSwapStatus(depositAddress)
      swapStatus = (statusResponse as any).status || 
                   (statusResponse as any).executionStatus ||
                   (statusResponse as any).state ||
                   'UNKNOWN'
    } catch (error) {
      console.warn('Error checking swap status:', error)
      // Continue even if status check fails
    }

    const normalizedStatus = String(swapStatus).toUpperCase()

    // Verify swap is successful
    if (normalizedStatus !== 'SUCCESS' && normalizedStatus !== 'UNKNOWN') {
      return NextResponse.json(
        { 
          error: 'Swap not completed',
          message: `Swap status: ${normalizedStatus}. Payment cannot be verified.`,
          redirectUrl: tracking.redirectUrl,
          swapStatus: normalizedStatus,
          x402Executed: tracking.x402Executed || false,
          serviceName, // Include service name even in error response
        },
        { status: 402 } // Payment Required
      )
    }

    // All checks passed - return the redirect URL with payment verification
    return NextResponse.json({
      redirectUrl: tracking.redirectUrl,
      depositAddress: depositAddress, // Return the deposit address
      signedPayload: tracking.signedPayload, // Return the signed payload (transaction hash) for content page
      x402Executed: tracking.x402Executed || false,
      swapStatus: normalizedStatus,
      verified: true, // Payment is verified
      serviceName, // Include service name if available
    })
  } catch (error) {
    console.error('Error getting redirect URL:', error)
    return NextResponse.json(
      { error: 'Failed to get redirect URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

