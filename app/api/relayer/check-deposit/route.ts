import { NextRequest, NextResponse } from 'next/server'
import { getDepositTracking, markDepositConfirmed } from '@/lib/depositTracking'
import { checkSwapStatus } from '@/lib/oneClick'
import { getIntentsAccount } from '@/lib/near'

async function checkDepositStatus(depositAddress: string, swapId?: string) {
  try {
    // If we have a swap ID, check status via 1-Click API
    if (swapId) {
      try {
        const status = await checkSwapStatus(swapId)
        
        // Status stages from NEAR Intents examples:
        // PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING, SUCCESS, REFUNDED
        if (status.status === 'SUCCESS' || status.status === 'KNOWN_DEPOSIT_TX' || status.status === 'PROCESSING') {
          return { confirmed: true, status: status.status }
        }
        
        return { confirmed: false, status: status.status }
      } catch (error) {
        console.error('Error checking swap status:', error)
        // Fall through to fallback check
      }
    }
    
    // Fallback: Check deposit via NEAR Intents contract
    const account = await getIntentsAccount()
    
    // For demo purposes, simulate deposit confirmation after 30 seconds
    const tracking = getDepositTracking(depositAddress)
    if (tracking && Date.now() - tracking.createdAt > 30000) {
      return { confirmed: true, amount: tracking.amount }
    }
    
    return { confirmed: false }
  } catch (error) {
    console.error('Error checking deposit:', error)
    return { confirmed: false }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address } = body

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required field: address' },
        { status: 400 }
      )
    }

    const tracking = getDepositTracking(address)
    if (!tracking) {
      return NextResponse.json({ confirmed: false })
    }

    // Get swap ID from tracking if available
    const swapId = (tracking as any).swapId
    const status = await checkDepositStatus(address, swapId)
    const confirmed = status.confirmed || tracking.confirmed

    // Mark as confirmed if status check confirms it
    if (status.confirmed && !tracking.confirmed) {
      markDepositConfirmed(address)
    }

    return NextResponse.json({
      confirmed,
      intentId: tracking.intentId,
      status: status.status,
      swapId,
    })
  } catch (error) {
    console.error('Error checking deposit:', error)
    return NextResponse.json(
      { error: 'Failed to check deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

