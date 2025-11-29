#!/usr/bin/env node

/**
 * Cronjob script to check deposit statuses every 5 seconds
 * 
 * Usage:
 *   node scripts/run-cronjob.js
 */

const API_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const CRONJOB_ENDPOINT = `${API_URL}/api/relayer/cronjob-check-deposits`
const INTERVAL_MS = 5000 // 5 seconds

async function runCronjob() {
  try {
    const startTime = new Date().toISOString()
    console.log(`[${startTime}] 🔄 Checking deposits...`)

    const response = await fetch(CRONJOB_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Error: HTTP ${response.status}`)
      console.error(errorText)
      return
    }

    const data = await response.json()

    if (data.success) {
      console.log(`✅ Checked ${data.checked} deposits`)
      
      // Log results
      if (data.results && data.results.length > 0) {
        console.log('\nResults:')
        data.results.forEach((result) => {
          const icon = result.action === 'x402_executed' ? '✅' :
                      result.action === 'x402_failed' ? '❌' :
                      result.action === 'error' ? '⚠️' : '⏭️'
          
          console.log(`  ${icon} ${result.depositAddress.substring(0, 20)}...`)
          console.log(`     Status: ${result.status}`)
          console.log(`     Action: ${result.action}`)
          
          if (result.reason) {
            console.log(`     Reason: ${result.reason}`)
          }
          if (result.error) {
            console.log(`     Error: ${result.error}`)
          }
          if (result.signedPayload) {
            console.log(`     ✅ Signed payload saved`)
          }
        })
      } else {
        console.log('  No deposits to process')
      }
    } else {
      console.error('❌ Cronjob returned unsuccessful result')
    }
  } catch (error) {
    console.error('❌ Error running cronjob:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
  }
}

async function main() {
  console.log('🔄 Starting cronjob to check deposit statuses every 5 seconds')
  console.log(`API URL: ${CRONJOB_ENDPOINT}`)
  console.log('Press Ctrl+C to stop\n')

  // Run immediately
  await runCronjob()

  // Then run every 5 seconds
  const interval = setInterval(async () => {
    await runCronjob()
    console.log('') // Empty line for readability
  }, INTERVAL_MS)

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping cronjob...')
    clearInterval(interval)
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Stopping cronjob...')
    clearInterval(interval)
    process.exit(0)
  })
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

