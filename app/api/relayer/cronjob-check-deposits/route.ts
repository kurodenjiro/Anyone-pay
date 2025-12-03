import { NextRequest, NextResponse } from 'next/server'
import { getDepositsWithDeadlineRemaining, updateDepositTracking } from '@/lib/depositTracking'
import { checkSwapStatus } from '@/lib/oneClick'

/**
 * Cronjob endpoint to check deposit statuses and execute x402 payments
 * Should be called every 5 seconds
 * 
 * Flow:
 * 1. Get all deposits with deadline still remaining
 * 2. Check each deposit status using OneClickService.getExecutionStatus
 * 3. If status is SUCCESS and not signed, execute x402 payment
 * 4. Save signedPayload to DB
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    console.log('🔄 Cronjob: Checking deposit statuses...')
    
    // Get all deposits with deadline still remaining
    const deposits = await getDepositsWithDeadlineRemaining()
    console.log(`📦 Found ${deposits.length} deposits with deadline remaining`)

    const results = []

    for (const [depositAddress, tracking] of deposits) {
      try {
        // Check status using OneClickService.getExecutionStatus
        const statusResponse = await checkSwapStatus(depositAddress)
        
        // Extract status from response
        const status = (statusResponse as any).status || 
                      (statusResponse as any).executionStatus ||
                      (statusResponse as any).state ||
                      'PENDING_DEPOSIT'
        
        const normalizedStatus = String(status).toUpperCase()
        
        console.log(`  ${depositAddress}: ${normalizedStatus}`)

        // Only execute x402 if status is SUCCESS and not already signed
        if (normalizedStatus === 'SUCCESS' && !tracking.signedPayload && !tracking.x402Executed) {
          console.log(`  ✅ Deposit ${depositAddress} is SUCCESS, executing x402 payment...`)
          
          // Check if we have required data for x402 payment
          if (!tracking.nearAccountId || !tracking.swapWalletAddress || !tracking.redirectUrl || !tracking.chain) {
            console.log(`  ⚠️ Missing required data for x402 payment: ${depositAddress}`)
            results.push({
              depositAddress,
              status: normalizedStatus,
              action: 'skipped',
              reason: 'Missing required data for x402 payment'
            })
            continue
          }

          try {
            // Get quote from quoteData stored in tracking
            if (!tracking.quoteData) {
              console.log(`  ⚠️ No quoteData found for ${depositAddress}`)
              results.push({
                depositAddress,
                status: normalizedStatus,
                action: 'skipped',
                reason: 'No quoteData found'
              })
              continue
            }

            const quoteData = typeof tracking.quoteData === 'string' 
              ? JSON.parse(tracking.quoteData) 
              : tracking.quoteData

            // Extract quote fields - check multiple possible locations in the response
            const quote = quoteData?.quote || quoteData?.quoteResponse || quoteData
            
            // Extract x402 payment fields from quote
            // These should come from the redirectUrl's 402 response, not the swap quote
            // For now, we'll use the recipient address as payTo
            const payTo = quote?.payTo || tracking.recipient || quote?.recipient
            const maxAmountRequired = quote?.maxAmountRequired || quote?.amount || tracking.amount
            const deadline = Math.floor(Date.now() / 1000) + 3600
            const nonce = `0x${Date.now().toString(16)}`

            if (!payTo || !maxAmountRequired || !deadline || !nonce) {
              console.log(`  ⚠️ Missing required x402 fields for ${depositAddress}:`, {
                payTo: !!payTo,
                maxAmountRequired: !!maxAmountRequired,
                deadline: !!deadline,
                nonce: !!nonce
              })
              results.push({
                depositAddress,
                status: normalizedStatus,
                action: 'skipped',
                reason: 'Missing required x402 fields in quote'
              })
              continue
            }
            // const exampleQuote = {
            //   // Address to pay to (recipient)
            //   payTo: process.env.TEST_X402_PAY_TO || '0x03fBbA1b1A455d028b074D9abC2b23d3EF786943',
              
            //   // Maximum amount required (in USDC, as string)
            //   maxAmountRequired: '0.1', // 0.1 USDC
              
            //   // Deadline timestamp (Unix timestamp in seconds)
            //   deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
              
            //   // Nonce (unique identifier for this payment) - should be a hex string or number
            //   nonce: process.env.TEST_X402_NONCE || Date.now().toString(),
            // }
            // Execute x402 payment by signing and broadcasting the transaction
            console.log({
              payTo,
              maxAmountRequired: String(maxAmountRequired),
              deadline: Math.floor(Date.now() / 1000) + 3600,
              nonce: String(nonce),
            })
            const { signX402TransactionWithChainSignature } = await import('@/lib/chainSig')

            const transactionHash = await signX402TransactionWithChainSignature({
              payTo,
              maxAmountRequired: String(maxAmountRequired),
              deadline: Math.floor(Date.now() / 1000) + 3600,
              nonce: String(nonce),
            })

            // Save transaction hash as signedPayload and mark as executed
            await updateDepositTracking(depositAddress, {
              signedPayload: transactionHash,
              x402Executed: true,
              confirmed: true,
              confirmedAt: Date.now()
            })

            console.log(`  ✅ x402 payment executed and saved for ${depositAddress}`)
            results.push({
              depositAddress,
              status: normalizedStatus,
              action: 'x402_executed',
              transactionHash: transactionHash
            })
          } catch (error) {
            console.error(`  ❌ Error executing x402 payment for ${depositAddress}:`, error)
            results.push({
              depositAddress,
              status: normalizedStatus,
              action: 'x402_error',
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        } else {
          // For other statuses or if already signed, skip
          const reason = tracking.signedPayload 
            ? 'Already signed' 
            : tracking.x402Executed 
              ? 'Already executed' 
              : `Status is ${normalizedStatus} (not SUCCESS)`
          
          results.push({
            depositAddress,
            status: normalizedStatus,
            action: 'skipped',
            reason
          })
        }
      } catch (error) {
        console.error(`  ❌ Error checking status for ${depositAddress}:`, error)
        results.push({
          depositAddress,
          status: 'ERROR',
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checked: deposits.length,
      results
    })
  } catch (error) {
    console.error('Error in cronjob:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run cronjob', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

