import { NextRequest, NextResponse } from 'next/server'
import { getDepositTracking, markDepositConfirmed } from '@/lib/depositTracking'
import { checkSwapStatus } from '@/lib/oneClick'

/**
 * Check deposit status endpoint
 * Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/5-check-status-OPTIONAL.ts
 * 
 * Status values from 1-Click API:
 * - PENDING_DEPOSIT: Awaiting the deposit to the deposit address
 * - PROCESSING: Once the deposit on deposit address is detected, information is processed and executed by Market Makers
 * - SUCCESS: Funds are delivered to the specified destination chain/address
 * - INCOMPLETE_DEPOSIT: Deposit is received but below required bridge or quoted amount
 * - REFUNDED: If the swap is not completed, funds are automatically returned to the refund address
 * - FAILED: Swap failed due to the error
 */
async function checkDepositStatus(depositAddress: string, tracking?: any) {
  try {
    // Check status via 1-Click SDK using deposit address
    const statusResponse = await checkSwapStatus(depositAddress)
    
    // Log full status response for debugging
    console.log('📦 Full status response:', JSON.stringify(statusResponse, null, 2))
    
    // Extract status from SDK response
    // The SDK response structure may vary - check multiple possible locations
    let status = (statusResponse as any).status || 
                 (statusResponse as any).executionStatus ||
                 (statusResponse as any).state ||
                 'PENDING_DEPOSIT'
    
    // Normalize status to uppercase for consistency
    status = String(status).toUpperCase()
    
    console.log(`   Current status: ${status}`)
    console.log(`   Status type: ${typeof status}`)
    
    // Handle exact status values from 1-Click API
    
    // SUCCESS: Funds are delivered to the specified destination chain/address
    if (status === 'SUCCESS') {
      console.log('🎉 Intent Fulfilled! Funds delivered successfully.')
      return { confirmed: true, status, statusResponse }
    }
    
    // REFUNDED: If the swap is not completed, funds are automatically returned to the refund address
    if (status === 'REFUNDED') {
      console.log(`❌ Swap not completed. Funds refunded. Status: ${status}`)
      return { confirmed: false, status, refunded: true, statusResponse }
    }
    
    // FAILED: Swap failed due to the error
    if (status === 'FAILED') {
      console.log(`❌ Swap failed. Status: ${status}`)
      return { confirmed: false, status, failed: true, statusResponse }
    }
    
    // PROCESSING: Once the deposit on deposit address is detected, information is processed and executed by Market Makers
    if (status === 'PROCESSING') {
      console.log(`⏳ Processing swap. Status: ${status}`)
      return { confirmed: false, status, processing: true, statusResponse }
    }
    
    // INCOMPLETE_DEPOSIT: Deposit is received but below required bridge or quoted amount
    if (status === 'INCOMPLETE_DEPOSIT') {
      console.log(`⚠️ Incomplete deposit. Status: ${status}`)
      return { confirmed: false, status, incompleteDeposit: true, statusResponse }
    }
    
    // PENDING_DEPOSIT: Awaiting the deposit to the deposit address
    if (status === 'PENDING_DEPOSIT' || status === 'PENDING') {
      console.log(`⏳ Waiting for deposit. Status: ${status}`)
      return { confirmed: false, status, statusResponse }
    }
    
    // Default: return the status as-is (unknown status)
    console.log(`⚠️ Unknown status: ${status}`)
    return { confirmed: false, status, statusResponse }
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
    
    // Check status via 1-Click API (works even without tracking data)
    const status = await checkDepositStatus(address, tracking)
    const confirmed = status.confirmed

    // Mark as confirmed if status check confirms it and we have tracking
    if (tracking && status.confirmed && !tracking.confirmed) {
      markDepositConfirmed(address)
    }

    // Use the statusResponse from checkDepositStatus instead of making a duplicate call
    // This ensures we get the swap status data that was already retrieved
    const swapStatusResponse = status.statusResponse || null

    return NextResponse.json({
      confirmed,
      intentId: tracking?.intentId,
      status: status.status || 'PENDING_DEPOSIT',
      depositAddress: address,
      refunded: status.refunded || false,
      processing: status.processing || false,
      failed: status.failed || false,
      incompleteDeposit: status.incompleteDeposit || false,
      swapStatus: swapStatusResponse, // Include full swap status response from checkDepositStatus
      // Include tracking data for loading from URL (if available)
      amount: tracking?.amount,
      chain: tracking?.chain,
      redirectUrl: tracking?.redirectUrl,
      intentType: tracking?.intentType,
      signedPayload: tracking?.signedPayload, // Include signedPayload if available
      swapWalletAddress: tracking?.swapWalletAddress, // Include swap wallet address for content page
    })
  } catch (error) {
    console.error('Error checking deposit:', error)
    return NextResponse.json(
      { error: 'Failed to check deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

