/**
 * Test script for executeX402Payment function
 * 
 * Usage:
 *   npm run test:x402
 *   OR
 *   npx tsx scripts/test-execute-x402.ts
 * 
 * Make sure to set environment variables in .env.local:
 *   - NEAR_PROXY_ACCOUNT_ID
 *   - NEAR_PROXY_PRIVATE_KEY
 *   - NEXT_PUBLIC_NEAR_NETWORK
 */

// Load environment variables from .env.local if available
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

/**
 * Test executeX402Payment with example data
 */
async function testExecuteX402Payment() {
  try {
    // Dynamic import for TypeScript module
    const { executeX402Payment } = await import('../lib/wallet')
    
    // Example data for testing
    const exampleData = {
      // Ethereum address derived from NEAR account (swap wallet address)
      // This is the address that will sign the payment
      ethAddress: '0x1234567890123456789012345678901234567890',
      
      // Target API URL that requires x402 payment
      // This should return a 402 status with a quote in the response body
      // Example response format:
      // {
      //   "payTo": "0x...",
      //   "maxAmountRequired": "10.0",
      //   "deadline": 1234567890,
      //   "nonce": "..."
      // }
      targetApiUrl: 'https://example.com/api/premium-content',
      
      // Target chain (base, solana, near)
      chain: 'base'
    }
    
    console.log('🧪 Testing executeX402Payment function...')
    console.log('')
    console.log('Test Parameters:')
    console.log('  - ethAddress:', exampleData.ethAddress)
    console.log('  - targetApiUrl:', exampleData.targetApiUrl)
    console.log('  - chain:', exampleData.chain)
    console.log('')
    
    // Check environment variables
    if (!process.env.NEAR_PROXY_ACCOUNT_ID) {
      console.warn('⚠️  NEAR_PROXY_ACCOUNT_ID not set in environment')
      console.warn('   Set this in .env.local to test Chain Signatures')
    } else {
      console.log('✅ NEAR_PROXY_ACCOUNT_ID:', process.env.NEAR_PROXY_ACCOUNT_ID)
    }
    
    if (!process.env.NEAR_PROXY_PRIVATE_KEY) {
      console.warn('⚠️  NEAR_PROXY_PRIVATE_KEY not set in environment')
      console.warn('   Set this in .env.local to test Chain Signatures')
    } else {
      console.log('✅ NEAR_PROXY_PRIVATE_KEY: [HIDDEN]')
    }
    console.log('')
    
    // Execute the function
    console.log('📤 Calling executeX402Payment...')
    console.log('   (This will fetch from targetApiUrl and expect a 402 response)')
    console.log('')
    
    const result = await executeX402Payment(
      exampleData.ethAddress,
      exampleData.targetApiUrl,
      exampleData.chain
    )
    
    console.log('📥 Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log('')
    
    if (result.success) {
      console.log('✅ Payment executed successfully!')
      if (result.signedPayload) {
        const payload = JSON.parse(result.signedPayload)
        console.log('  - Signed Payload Type:', payload.type)
        console.log('  - Signature:', payload.signature?.substring(0, 50) + '...')
        console.log('  - Full Payload Length:', result.signedPayload.length, 'chars')
      }
      if (result.settlementHash) {
        console.log('  - Settlement Hash:', result.settlementHash)
      }
      if (result.data) {
        console.log('  - Response Data:', JSON.stringify(result.data, null, 2))
      }
    } else {
      console.log('❌ Payment failed:', result.error)
      console.log('')
      console.log('Note: This is expected if the targetApiUrl does not return a 402 status')
      console.log('      or if Chain Signatures are not properly configured.')
    }
    
  } catch (error) {
    console.error('❌ Error testing executeX402Payment:', error)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

/**
 * Test signX402PaymentPayload with example quote data
 * This tests just the signing part without making HTTP requests
 */
async function testSignX402PaymentPayload() {
  try {
    const { signX402PaymentPayload } = await import('../lib/wallet')
    
    console.log('🧪 Testing signX402PaymentPayload with example quote...')
    console.log('')
    
    // Example quote data (what the target API would return in a 402 response)
    const exampleQuote = {
      // Address to pay to (recipient)
      payTo: '0x9876543210987654321098765432109876543210',
      
      // Maximum amount required (in USDC, as string)
      maxAmountRequired: '10.0', // 10 USDC
      
      // Deadline timestamp (Unix timestamp in seconds)
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      
      // Nonce (unique identifier for this payment)
      nonce: '1234567890123456789012345678901234567890123456789012345678901234'
    }
    
    const exampleData = {
      // Ethereum address that will sign (from address)
      ethAddress: '0x1234567890123456789012345678901234567890',
      
      // Chain to sign for
      chain: 'base'
    }
    
    console.log('Example Quote (what API returns in 402 response):')
    console.log(JSON.stringify(exampleQuote, null, 2))
    console.log('')
    console.log('Signing Parameters:')
    console.log('  - From Address (ethAddress):', exampleData.ethAddress)
    console.log('  - Chain:', exampleData.chain)
    console.log('')
    
    // Sign the payload
    console.log('📝 Signing payload with Chain Signatures...')
    const signedPayload = await signX402PaymentPayload(
      exampleData.ethAddress,
      exampleQuote,
      exampleData.chain
    )
    
    console.log('')
    console.log('✅ Signed Payload Generated:')
    console.log(signedPayload)
    console.log('')
    
    // Parse and display
    const payload = JSON.parse(signedPayload)
    console.log('Parsed Payload Structure:')
    console.log('  - Type:', payload.type)
    console.log('  - Signature Length:', payload.signature?.length || 0, 'chars')
    console.log('  - Signature Preview:', payload.signature?.substring(0, 50) + '...')
    console.log('  - Data:')
    console.log('    - from:', payload.data.from)
    console.log('    - to:', payload.data.to)
    console.log('    - value:', payload.data.value.toString())
    console.log('    - validAfter:', payload.data.validAfter)
    console.log('    - validBefore:', payload.data.validBefore)
    console.log('    - nonce:', payload.data.nonce)
    console.log('')
    console.log('This payload can be sent in the X-PAYMENT header to complete the payment.')
    
  } catch (error) {
    console.error('❌ Error testing signX402PaymentPayload:', error)
    console.error('Stack:', error.stack)
    console.log('')
    console.log('Common issues:')
    console.log('  - NEAR_PROXY_ACCOUNT_ID not set')
    console.log('  - NEAR_PROXY_PRIVATE_KEY not set')
    console.log('  - Chain Signatures not properly configured')
    process.exit(1)
  }
}

// Run tests
async function main() {
  const testType = process.argv[2] || 'sign'
  
  console.log('='.repeat(60))
  console.log('executeX402Payment Test Script')
  console.log('='.repeat(60))
  console.log('')
  
  if (testType === 'sign') {
    await testSignX402PaymentPayload()
  } else if (testType === 'execute') {
    await testExecuteX402Payment()
  } else {
    console.log('Usage:')
    console.log('  npm run test:x402 sign    - Test signing with mock quote (default)')
    console.log('  npm run test:x402 execute - Test full execution (requires real API)')
    console.log('')
    console.log('Running sign test by default...')
    console.log('')
    await testSignX402PaymentPayload()
  }
}

main().catch(console.error)

