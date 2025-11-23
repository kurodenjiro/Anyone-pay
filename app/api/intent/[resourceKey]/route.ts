// API route for handling NEAR Intent execution with X402 payment
// This is called when user clicks the data drop URL

import { NextRequest, NextResponse } from 'next/server'
import { getDataDropByResourceKey, checkX402Payment, createRetrieveDataIntent, executeX402Payment, executeDataRetrievalIntent } from '@/lib/dataDrop'

export async function GET(
  request: NextRequest,
  { params }: { params: { resourceKey: string } }
) {
  try {
    const { resourceKey } = params

    if (!resourceKey) {
      return NextResponse.json(
        { error: 'Missing resource key' },
        { status: 400 }
      )
    }

    // Get data drop by resource key
    const dataDrop = await getDataDropByResourceKey(resourceKey)
    
    if (!dataDrop) {
      return NextResponse.json(
        { error: 'Data drop not found' },
        { status: 404 }
      )
    }

    // Create NEAR Intent
    const intent = createRetrieveDataIntent(dataDrop)

    // Check X402 payment requirement
    const x402Check = await checkX402Payment(dataDrop.contractId, resourceKey)

    if (x402Check.required) {
      // Return X402 payment required response
      return NextResponse.json(
        {
          intent,
          x402: {
            required: true,
            amount: x402Check.amount,
            token: x402Check.token,
            destination: x402Check.destination,
            message: 'Payment required to access encrypted data',
          },
        },
        { status: 402 } // HTTP 402 Payment Required
      )
    }

    // If no payment required, return intent for direct execution
    return NextResponse.json({
      intent,
      x402: { required: false },
    })
  } catch (error) {
    console.error('Error handling intent:', error)
    return NextResponse.json(
      { error: 'Failed to process intent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST endpoint for executing the intent after payment
export async function POST(
  request: NextRequest,
  { params }: { params: { resourceKey: string } }
) {
  try {
    const { resourceKey } = params
    const body = await request.json()
    const { accountId, privateKey } = body

    if (!resourceKey || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceKey, accountId' },
        { status: 400 }
      )
    }

    // Get data drop
    const dataDrop = await getDataDropByResourceKey(resourceKey)
    
    if (!dataDrop) {
      return NextResponse.json(
        { error: 'Data drop not found' },
        { status: 404 }
      )
    }

    // Create intent
    const intent = createRetrieveDataIntent(dataDrop)

    // Execute X402 payment if required
    if (dataDrop.requiredPayment) {
      const paymentResult = await executeX402Payment(intent, accountId, privateKey)
      
      if (!paymentResult.success) {
        return NextResponse.json(
          { error: 'Payment failed' },
          { status: 402 }
        )
      }
    }

    // Execute data retrieval intent
    // The Intent Solver uses Private Key A from the data drop
    const retrievalResult = await executeDataRetrievalIntent(
      intent,
      privateKey // Optional, will use stored private key if not provided
    )

    if (!retrievalResult.success) {
      return NextResponse.json(
        { error: 'Data retrieval failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: retrievalResult.data,
      transactionHash: retrievalResult.transactionHash,
    })
  } catch (error) {
    console.error('Error executing intent:', error)
    return NextResponse.json(
      { error: 'Failed to execute intent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

