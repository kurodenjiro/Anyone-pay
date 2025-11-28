import { NextRequest, NextResponse } from 'next/server'
import { getDepositTrackingBySwapWallet } from '@/lib/depositTracking'

/**
 * Get target API URL from database by swap wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required parameter: address' },
        { status: 400 }
      )
    }

    // Look up deposit tracking by swap wallet address
    const tracking = getDepositTrackingBySwapWallet(address)

    if (!tracking || !tracking.redirectUrl) {
      return NextResponse.json(
        { error: 'Redirect URL not found for this address' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      redirectUrl: tracking.redirectUrl,
      depositAddress: tracking.swapId, // Optional: return deposit address if needed
    })
  } catch (error) {
    console.error('Error getting redirect URL:', error)
    return NextResponse.json(
      { error: 'Failed to get redirect URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

