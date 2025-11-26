import { NextRequest, NextResponse } from 'next/server'
import { getDepositTracking, markDepositConfirmed } from '@/lib/depositTracking'
import { checkSwapStatus } from '@/lib/oneClick'

/**
 * Check deposit status endpoint
 * Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/5-check-status-OPTIONAL.ts
 * 
 * Status values:
 * - SUCCESS: Intent fulfilled successfully
 * - REFUNDED: Swap failed and funds were refunded
 * - PENDING: Still processing
 * - PENDING_DEPOSIT: Waiting for deposit
 * - KNOWN_DEPOSIT_TX: Deposit transaction detected
 * - PROCESSING: Currently processing
 */
async function checkDepositStatus(depositAddress: string) {
  try {
    // Check status via 1-Click SDK using deposit address
    const statusResponse = await checkSwapStatus(depositAddress)
    
    // Extract status from SDK response
    // The SDK returns a response with a 'status' property
    const status = (statusResponse as any).status || 'PENDING'
    
    console.log(`   Current status: ${status}`)
    
    // Status stages from NEAR Intents examples:
    // PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING, SUCCESS, REFUNDED
    if (status === 'SUCCESS') {
      console.log('🎉 Intent Fulfilled!')
      return { confirmed: true, status }
    }
    
    if (status === 'REFUNDED') {
      console.log(`❌ Swap failed with status: ${status}`)
      return { confirmed: false, status, refunded: true }
    }
    
    // Processing states are not confirmed yet, but indicate progress
    if (status === 'KNOWN_DEPOSIT_TX' || status === 'PROCESSING') {
      return { confirmed: false, status, processing: true }
    }
    
    return { confirmed: false, status }
  } catch (error) {
    console.error('Error checking swap status via 1-Click SDK:', error)
    return { confirmed: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Handle empty or malformed request body
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is required' },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Unknown error' },
        { status: 400 }
      )
    }

    const { address } = body

    if (!address) {
      return NextResponse.json(
        { error: 'Missing required field: address' },
        { status: 400 }
      )
    }

    const tracking = getDepositTracking(address)
    if (!tracking) {
      return NextResponse.json({ confirmed: false, status: 'PENDING' })
    }

    // Check status via 1-Click API
    const status = await checkDepositStatus(address)
    const confirmed = status.confirmed

    // Mark as confirmed if status check confirms it
    if (status.confirmed && !tracking.confirmed) {
      markDepositConfirmed(address)
    }

    return NextResponse.json({
      confirmed,
      intentId: tracking.intentId,
      status: status.status || 'PENDING',
      depositAddress: address,
      refunded: status.refunded || false,
      processing: status.processing || false,
    })
  } catch (error) {
    console.error('Error checking deposit:', error)
    return NextResponse.json(
      { error: 'Failed to check deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

