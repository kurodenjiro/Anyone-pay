#!/usr/bin/env tsx
/**
 * Validates the Supabase SQL setup file
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const sqlPath = join(process.cwd(), 'supabase-setup.sql')

try {
  const sql = readFileSync(sqlPath, 'utf-8')
  
  console.log('✅ SQL file found:', sqlPath)
  console.log('📊 File size:', sql.length, 'characters')
  console.log('📝 Number of lines:', sql.split('\n').length)
  console.log('')
  
  // Check for required components
  const checks = {
    'pgvector extension': /CREATE EXTENSION.*vector/i.test(sql),
    'payment_services table': /CREATE TABLE.*payment_services/i.test(sql),
    'data_drops table': /CREATE TABLE.*data_drops/i.test(sql),
    'match_services function': /CREATE.*FUNCTION.*match_services/i.test(sql),
    'vector index': /CREATE INDEX.*embedding/i.test(sql),
    'trigger function': /CREATE.*FUNCTION.*update_updated_at/i.test(sql),
  }
  
  console.log('🔍 Validation Results:')
  console.log('')
  
  let allPassed = true
  for (const [check, passed] of Object.entries(checks)) {
    const icon = passed ? '✅' : '❌'
    console.log(`   ${icon} ${check}`)
    if (!passed) allPassed = false
  }
  
  console.log('')
  
  if (allPassed) {
    console.log('✅ All checks passed! SQL file is ready to run.')
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Go to https://supabase.com/dashboard')
    console.log('   2. Select your project')
    console.log('   3. Open SQL Editor')
    console.log('   4. Copy the contents of supabase-setup.sql')
    console.log('   5. Paste and click "Run"')
  } else {
    console.log('❌ Some checks failed. Please review the SQL file.')
    process.exit(1)
  }
  
} catch (error) {
  console.error('❌ Error reading SQL file:', error)
  process.exit(1)
}

