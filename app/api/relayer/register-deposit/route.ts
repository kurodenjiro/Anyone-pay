import { NextRequest, NextResponse } from 'next/server'
import { registerDeposit } from '@/lib/depositTracking'
import { getSwapQuote, ASSETS } from '@/lib/oneClick'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intentId, intentType, amount, recipient, senderAddress } = body

    if (!intentId || !intentType || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: intentId, intentType, amount' },
        { status: 400 }
      )
    }

    let depositAddress: string
    let swapId: string | undefined

    // For swap intents, get real deposit address from 1-Click API
    if (intentType === 'swap') {
      try {
        const quote = await getSwapQuote({
          senderAddress: senderAddress || 'anyone-pay.testnet',
          recipientAddress: recipient || senderAddress || 'anyone-pay.testnet',
          originAsset: ASSETS.NEAR,
          destinationAsset: ASSETS.USDC_ARB, // Default to USDC on Arbitrum
          amount: amount.includes('.') ? (parseFloat(amount) * 1e24).toString() : amount,
          isTest: true, // Set to false for production
        })

        depositAddress = quote.depositAddress
        swapId = quote.swapId
      } catch (error) {
        console.error('Error getting swap quote:', error)
        // Fallback to mock address if 1-Click API fails
        depositAddress = `intents.testnet::deposit::${intentType}::${Date.now()}`
      }
    } else {
      // For payment intents, generate Zcash deposit address
      // In production, this would integrate with Zcash wallet API
      depositAddress = generateZcashAddress(intentId)
    }
    
    function generateZcashAddress(id: string): string {
      // Generate Zcash Sapling shielded address (zs1 format)
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      const randomPart = Array.from({ length: 74 }, () => 
        chars[Math.floor(Math.random() * chars.length)]
      ).join('')
      return `zs1${randomPart}`
    }

    const result = registerDeposit(depositAddress, intentId, amount, recipient, swapId, intentType)

    return NextResponse.json({
      ...result,
      depositAddress,
      swapId,
    })
  } catch (error) {
    console.error('Error registering deposit:', error)
    return NextResponse.json(
      { error: 'Failed to register deposit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

