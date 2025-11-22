import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingDeposits, markDepositConfirmed, getDepositTracking } from '@/lib/depositTracking'
import { getContract, getIntentsAccount, CONFIG } from '@/lib/near'

async function checkDepositStatus(depositAddress: string) {
  try {
    // In production, this would query the NEAR Intents contract
    const account = await getIntentsAccount()
    
    // Mock: Check if deposit exists (in production, use actual view call)
    // const balance = await account.viewFunction(
    //   CONFIG.INTENTS_CONTRACT,
    //   'mt_batch_balance_of',
    //   { account_id: depositAddress }
    // )
    
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
    // This endpoint can be called periodically (e.g., via Vercel Cron Jobs)
    // or triggered by the frontend
    const pendingDeposits = getAllPendingDeposits()
    const results = []

    for (const [address, tracking] of pendingDeposits) {
      if (tracking.confirmed) continue

      const status = await checkDepositStatus(address)
      
      if (status.confirmed) {
        markDepositConfirmed(address)
        
        // Mark intent as funded in contract
        try {
          const contract = await getContract()
          
          // Note: These contract calls require proper authentication
          // In production, you'd need to sign transactions with a relayer key
          // await contract.mark_funded({
          //   intent_id: tracking.intentId,
          // })
          
          // Execute x402 payment
          // await contract.execute_x402_payment({
          //   intent_id: tracking.intentId,
          //   amount: tracking.amount,
          //   recipient: tracking.recipient || CONFIG.CONTRACT_ID,
          // })
          
          results.push({
            address,
            intentId: tracking.intentId,
            status: 'confirmed',
            message: `Intent ${tracking.intentId} funded and payment executed`,
          })
        } catch (error) {
          console.error(`Error executing payment for ${tracking.intentId}:`, error)
          results.push({
            address,
            intentId: tracking.intentId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
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
        
        try {
          const contract = await getContract()
          
          // Note: These contract calls require proper authentication
          // In production, you'd need to sign transactions with a relayer key
          // await contract.mark_funded({
          //   intent_id: tracking.intentId,
          // })
          
          // await contract.execute_x402_payment({
          //   intent_id: tracking.intentId,
          //   amount: tracking.amount,
          //   recipient: tracking.recipient || CONFIG.CONTRACT_ID,
          // })
          
          results.push({
            address,
            intentId: tracking.intentId,
            status: 'confirmed',
            message: `Intent ${tracking.intentId} funded and payment executed`,
          })
        } catch (error) {
          console.error(`Error executing payment for ${tracking.intentId}:`, error)
          results.push({
            address,
            intentId: tracking.intentId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
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

