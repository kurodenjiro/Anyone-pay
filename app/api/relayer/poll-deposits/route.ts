import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingDeposits, markDepositConfirmed, getDepositTracking } from '@/lib/depositTracking'

import { checkSwapStatus } from '@/lib/oneClick'

async function checkDepositStatus(depositAddress: string) {
  try {
    // Check status via 1-Click API using deposit address
    const statusResponse = await checkSwapStatus(depositAddress)
    const status = statusResponse.status
    
    // Status stages from NEAR Intents examples:
    // PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING, SUCCESS, REFUNDED
    if (status === 'SUCCESS' || status === 'KNOWN_DEPOSIT_TX' || status === 'PROCESSING') {
      return { confirmed: true, status }
    }
    
    if (status === 'REFUNDED') {
      return { confirmed: false, status, refunded: true }
    }
    
    return { confirmed: false, status }
  } catch (error) {
    console.error('Error checking deposit status via 1-Click API:', error)
    return { confirmed: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint can be called periodically (e.g., via Vercel Cron Jobs)
    // or triggered by the frontend
    const pendingDeposits = getAllPendingDeposits()
    const results = []

    for (const [address, tracking] of pendingDeposits) {
      if (tracking.confirmed) continue

      const status = await checkDepositStatus(address)
      
      if (status.confirmed) {
        markDepositConfirmed(address)
        
        results.push({
          address,
          intentId: tracking.intentId,
          status: 'confirmed',
          message: `Intent ${tracking.intentId} funded via 1-Click API`,
          swapStatus: status.status,
        })
      } else if (status.refunded) {
        results.push({
          address,
          intentId: tracking.intentId,
          status: 'refunded',
          message: `Swap was refunded`,
          swapStatus: status.status,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingDeposits.length,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Error polling deposits:', error)
    return NextResponse.json(
      { error: 'Failed to poll deposits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also support GET for easy cron job setup
export async function GET() {
  try {
    const pendingDeposits = getAllPendingDeposits()
    const results = []

    for (const [address, tracking] of pendingDeposits) {
      if (tracking.confirmed) continue

      const status = await checkDepositStatus(address)
      
      if (status.confirmed) {
        markDepositConfirmed(address)
        
        results.push({
          address,
          intentId: tracking.intentId,
          status: 'confirmed',
          message: `Intent ${tracking.intentId} funded via 1-Click API`,
          swapStatus: status.status,
        })
      } else if (status.refunded) {
        results.push({
          address,
          intentId: tracking.intentId,
          status: 'refunded',
          message: `Swap was refunded`,
          swapStatus: status.status,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: pendingDeposits.length,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error('Error polling deposits:', error)
    return NextResponse.json(
      { error: 'Failed to poll deposits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

