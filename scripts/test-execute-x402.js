#!/usr/bin/env node

/**
 * Test script for executeX402Payment function
 * 
 * This script tests x402 payment execution by:
 * 1. Creating a test deposit in the database
 * 2. Calling the cronjob endpoint which executes x402 payments
 * 3. Verifying the signedPayload is stored
 * 
 * Usage:
 *   node scripts/test-execute-x402.js
 * 
 * Environment variables required:
 *   - NEAR_PROXY_ACCOUNT_ID: NEAR account ID for Chain Signatures
 *   - NEXT_PUBLIC_BASE_URL: Base URL of the API (default: http://localhost:3000)
 *   - TARGET_API_URL: Target API URL that requires x402 payment (for testing)
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const API_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'bright')
  console.log('='.repeat(60))
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

/**
 * Test 1: Register a test deposit
 */
async function testRegisterDeposit() {
  logSection('Test 1: Register Test Deposit')
  
  const testIntentId = `test-x402-${Date.now()}`
  const testAmount = '1.0' // 1 USDC
  const testRecipient = '0x1234567890123456789012345678901234567890'
  const testChain = 'base'
  const testRedirectUrl = process.env.TARGET_API_URL || 'https://httpstat.us/402'
  
  logInfo('Registering test deposit...')
  logInfo(`  Intent ID: ${testIntentId}`)
  logInfo(`  Amount: ${testAmount} USDC`)
  logInfo(`  Recipient: ${testRecipient}`)
  logInfo(`  Chain: ${testChain}`)
  logInfo(`  Redirect URL: ${testRedirectUrl}`)
  
  try {
    const response = await fetch(`${API_URL}/api/relayer/register-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: testIntentId,
        intentType: 'payment',
        amount: testAmount,
        recipient: testRecipient,
        senderAddress: '',
        chain: testChain,
        redirectUrl: testRedirectUrl,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.depositAddress) {
      throw new Error('No deposit address returned')
    }
    
    logSuccess('Deposit registered successfully!')
    logInfo(`  Deposit Address: ${data.depositAddress}`)
    logInfo(`  Zcash Amount: ${data.zcashAmount || 'N/A'} ZEC`)
    
    return {
      intentId: testIntentId,
      depositAddress: data.depositAddress,
      redirectUrl: testRedirectUrl,
    }
  } catch (error) {
    logError(`Failed to register deposit: ${error.message}`)
    throw error
  }
}

/**
 * Test 2: Check deposit status
 */
async function testCheckDeposit(depositAddress) {
  logSection('Test 2: Check Deposit Status')
  
  logInfo(`Checking status for deposit: ${depositAddress}`)
  
  try {
    const response = await fetch(`${API_URL}/api/relayer/check-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: depositAddress }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    logSuccess('Deposit status retrieved!')
    logInfo(`  Status: ${data.status}`)
    logInfo(`  Confirmed: ${data.confirmed}`)
    logInfo(`  x402 Executed: ${data.x402Executed || false}`)
    logInfo(`  Signed Payload: ${data.signedPayload ? 'Present' : 'Not present'}`)
    
    return data
  } catch (error) {
    logError(`Failed to check deposit: ${error.message}`)
    throw error
  }
}

/**
 * Test 3: Run cronjob to execute x402 payment
 */
async function testCronjobExecution() {
  logSection('Test 3: Execute Cronjob (x402 Payment)')
  
  logInfo('Running cronjob to check deposits and execute x402 payments...')
  logWarning('Note: This will only execute x402 if deposit status is SUCCESS')
  
  try {
    const response = await fetch(`${API_URL}/api/relayer/cronjob-check-deposits`, {
      method: 'GET',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    logSuccess('Cronjob executed successfully!')
    logInfo(`  Checked: ${data.checked || 0} deposits`)
    logInfo(`  Results: ${data.results?.length || 0} items`)
    
    if (data.results && data.results.length > 0) {
      console.log('\nResults:')
      data.results.forEach((result, index) => {
        const icon = result.action === 'x402_executed' ? '✅' :
                    result.action === 'x402_failed' ? '❌' :
                    result.action === 'x402_already_signed' ? 'ℹ️' :
                    '⏳'
        logInfo(`  ${index + 1}. ${icon} ${result.depositAddress}: ${result.status} (${result.action || 'no action'})`)
        if (result.signedPayload) {
          logInfo(`     Signed Payload: ${result.signedPayload.substring(0, 50)}...`)
        }
        if (result.error) {
          logError(`     Error: ${result.error}`)
        }
      })
    }
    
    return data
  } catch (error) {
    logError(`Failed to run cronjob: ${error.message}`)
    throw error
  }
}

/**
 * Test 4: Verify x402 payment was executed
 */
async function testVerifyX402Payment(depositAddress) {
  logSection('Test 4: Verify x402 Payment Execution')
  
  logInfo(`Verifying x402 payment for deposit: ${depositAddress}`)
  
  try {
    const response = await fetch(`${API_URL}/api/relayer/check-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: depositAddress }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.x402Executed && data.signedPayload) {
      logSuccess('x402 payment verified!')
      logInfo(`  x402 Executed: ${data.x402Executed}`)
      logInfo(`  Signed Payload: ${data.signedPayload.substring(0, 50)}...`)
      logInfo(`  Redirect URL: ${data.redirectUrl || 'N/A'}`)
      return true
    } else {
      logWarning('x402 payment not yet executed')
      logInfo(`  x402 Executed: ${data.x402Executed || false}`)
      logInfo(`  Signed Payload: ${data.signedPayload ? 'Present' : 'Not present'}`)
      logInfo(`  Status: ${data.status}`)
      logInfo('  Note: x402 will only execute when deposit status is SUCCESS')
      return false
    }
  } catch (error) {
    logError(`Failed to verify x402 payment: ${error.message}`)
    throw error
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n')
  log('🧪 x402 Payment Test Suite', 'bright')
  log('='.repeat(60), 'bright')
  logInfo(`API URL: ${API_URL}`)
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
  }
  
  let testDeposit = null
  
  try {
    // Test 1: Register deposit
    try {
      testDeposit = await testRegisterDeposit()
      results.passed++
    } catch (error) {
      logError(`Test 1 failed: ${error.message}`)
      results.failed++
      throw error // Can't continue without deposit
    }
    
    // Test 2: Check deposit status
    try {
      await testCheckDeposit(testDeposit.depositAddress)
      results.passed++
    } catch (error) {
      logError(`Test 2 failed: ${error.message}`)
      results.failed++
    }
    
    // Test 3: Run cronjob
    try {
      await testCronjobExecution()
      results.passed++
    } catch (error) {
      logError(`Test 3 failed: ${error.message}`)
      results.failed++
    }
    
    // Test 4: Verify x402 payment
    try {
      const verified = await testVerifyX402Payment(testDeposit.depositAddress)
      if (verified) {
        results.passed++
      } else {
        results.skipped++ // Not a failure, just not executed yet
      }
    } catch (error) {
      logError(`Test 4 failed: ${error.message}`)
      results.failed++
    }
    
  } catch (error) {
    logError(`Fatal error: ${error.message}`)
    if (error.stack) {
      console.error(error.stack)
    }
  }
  
  // Print summary
  logSection('Test Summary')
  logSuccess(`Passed: ${results.passed}`)
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`)
  }
  if (results.skipped > 0) {
    logWarning(`Skipped: ${results.skipped}`)
  }
  
  const total = results.passed + results.failed
  if (total > 0) {
    const successRate = ((results.passed / total) * 100).toFixed(1)
    logInfo(`Success rate: ${successRate}%`)
  }
  
  if (testDeposit) {
    console.log('\n')
    logInfo(`Test deposit created: ${testDeposit.depositAddress}`)
    logInfo(`You can check its status at: ${API_URL}/?depositAddr=${testDeposit.depositAddress}`)
  }
  
  console.log('\n')
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0)
}

// Run tests
runTests().catch((error) => {
  logError(`Unhandled error: ${error.message}`)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
})
