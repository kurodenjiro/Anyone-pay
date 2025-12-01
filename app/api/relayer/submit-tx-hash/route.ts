import { NextRequest, NextResponse } from 'next/server'
import { submitTxHash } from '@/lib/oneClick'
import { getDepositTracking, updateDepositTracking } from '@/lib/depositTracking'

/**
 * Submit transaction hash to speed up swap process
 * Based on: https://github.com/near-examples/near-intents-examples/blob/main/1click-example/4-submit-tx-hash-OPTIONAL.ts
 */
export async function POST(request: NextRequest) {
  console.log('POST /api/relayer/submit-tx-hash called')
  try {
    const body = await request.json()
    const { txHash, depositAddress } = body

    if (!txHash || !depositAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: txHash, depositAddress' },
        { status: 400 }
      )
    }

    // Validate transaction hash format (basic check)
    if (txHash.length < 10) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400 }
      )
    }

    

    // Submit transaction hash to 1-Click API
    try {
       await submitTxHash(txHash, depositAddress)
      
      // Update tracking
      updateDepositTracking(depositAddress, {
        txHashSubmitted: true,
        depositTxHash: txHash
      })

      return NextResponse.json({
        success: true,
        message: 'Transaction hash submitted successfully',
        txHash,
        depositAddress
      })
    } catch (error) {
      console.error('Error submitting transaction hash:', error)
      return NextResponse.json(
        { 
          error: 'Failed to submit transaction hash', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in submit-tx-hash route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

