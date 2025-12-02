/**
 * Test script for signX402TransactionWithChainSignature function
 * 
 * Usage:
 *   npx tsx scripts/test-sign-x402-transaction.js
 *   OR
 *   node --loader ts-node/esm scripts/test-sign-x402-transaction.js
 * 
 * Make sure to set environment variables in .env.local:
 *   - NEAR_PROXY_ACCOUNT_ID
 *   - NEAR_PROXY_PRIVATE_KEY
 *   - NEXT_PUBLIC_NEAR_NETWORK
 *   - NEAR_PROXY_CONTRACT_ID (optional, defaults to v1.signer)
 *   - NEAR_PROXY_CONTRACT (should be "true")
 *   - MPC_PATH (optional, defaults to "ethereum-1")
 */

// Load environment variables from .env.local if available
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

/**
 * Test signX402TransactionWithChainSignature with example data
 */
async function testSignX402TransactionWithChainSignature() {
  try {
   

    // Dynamic import for TypeScript module
    const { signX402TransactionWithChainSignature, getEthereumAddressFromProxyAccount } = await import('../lib/chainSig')
    
    console.log('🧪 Testing signX402TransactionWithChainSignature function...')
    console.log('')

    // Check environment variables
    if (!process.env.NEAR_PROXY_ACCOUNT_ID) {
      console.error('❌ NEAR_PROXY_ACCOUNT_ID not set in environment')
      console.error('   Set this in .env.local to test Chain Signatures')
      process.exit(1)
    }
    
    if (!process.env.NEAR_PROXY_PRIVATE_KEY) {
      console.error('❌ NEAR_PROXY_PRIVATE_KEY not set in environment')
      console.error('   Set this in .env.local to test Chain Signatures')
      process.exit(1)
    }

    // Get actual Ethereum address from NEAR account
    console.log('🔍 Getting Ethereum address from NEAR proxy account...')
    let ethAddress
    try {
      ethAddress = await getEthereumAddressFromProxyAccount()
      console.log('✅ Ethereum Address:', ethAddress)
    } catch (error) {
      console.error('❌ Failed to get Ethereum address:', error.message)
      console.error('   Using fallback address for testing...')
      ethAddress = '0x1234567890123456789012345678901234567890'
    }
    console.log('')

    // Example x402 quote data (what the target API would return in a 402 response)
    const exampleQuote = {
      // Address to pay to (recipient)
      payTo: process.env.TEST_X402_PAY_TO || '0x03fBbA1b1A455d028b074D9abC2b23d3EF786943',
      
      // Maximum amount required (in USDC, as string)
      maxAmountRequired: process.env.TEST_X402_AMOUNT || '0.1', // 0.1 USDC
      
      // Deadline timestamp (Unix timestamp in seconds)
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      
      // Nonce (unique identifier for this payment) - should be a hex string or number
      nonce: process.env.TEST_X402_NONCE || Date.now().toString(),
    }
    
    const exampleData = {
      // Ethereum address that will sign (from address)
      ethAddress: ethAddress,
      
      // Chain to sign for
      chain: process.env.TEST_X402_CHAIN || 'base',
      
      // Derivation path (optional)
      derivationPath: process.env.MPC_PATH || undefined,
    }
    
    console.log('Example Quote (what API returns in 402 response):')
    console.log(JSON.stringify(exampleQuote, null, 2))
    console.log('')
    console.log('Test Parameters:')
    console.log('  - ethAddress:', exampleData.ethAddress)
    console.log('  - chain:', exampleData.chain)
    console.log('  - derivationPath:', exampleData.derivationPath || 'default')
    console.log('')

    // Execute the function
    console.log('📤 Calling signX402TransactionWithChainSignature...')
    console.log('   (This will prepare transaction, sign hashes, and finalize)')
    console.log('')
    
    const result = await signX402TransactionWithChainSignature(
      exampleQuote
    )
    
    console.log('📥 Result:')
    console.log('')
    console.log('✅ Transaction signed and broadcast successfully!')
    console.log('')
    console.log('Transaction Hash:', result)
    console.log('')
    console.log('✅ Test completed successfully!')
    console.log('')
    console.log('The transaction has been broadcast to the blockchain.')
    console.log('You can view it on Base Explorer using the hash above.')
    
  } catch (error) {
    console.error('❌ Error testing signX402TransactionWithChainSignature:', error)
    console.error('Stack:', error.stack)
    console.log('')
    console.log('Common issues:')
    console.log('  - NEAR_PROXY_ACCOUNT_ID not set')
    console.log('  - NEAR_PROXY_PRIVATE_KEY not set')
    console.log('  - NEAR_PROXY_CONTRACT not set to "true"')
    console.log('  - Chain Signatures not properly configured')
    process.exit(1)
  }
}

// Run test
async function main() {
  console.log('='.repeat(60))
  console.log('signX402TransactionWithChainSignature Test Script')
  console.log('='.repeat(60))
  console.log('')
  
  await testSignX402TransactionWithChainSignature()
}

main().catch(console.error)
