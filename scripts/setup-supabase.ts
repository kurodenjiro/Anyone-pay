#!/usr/bin/env tsx
/**
 * Script to run Supabase SQL setup
 * 
 * This script executes the SQL setup file against your Supabase database.
 * 
 * Usage:
 *   npx tsx scripts/setup-supabase.ts
 * 
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local (for admin operations)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local')
  console.error('   Please add your Supabase project URL to .env.local')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local')
  console.error('   Please add your Supabase service role key to .env.local')
  console.error('   You can find it in: Supabase Dashboard > Settings > API > service_role key')
  process.exit(1)
}

// TypeScript narrowing: after the check, we know supabaseServiceKey is defined
const serviceKey: string = supabaseServiceKey

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function runSQLSetup() {
  console.log('🚀 Starting Supabase SQL setup...\n')

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'supabase-setup.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    console.log('📄 Read SQL file:', sqlPath)
    console.log('📊 Executing SQL statements...\n')

    // Split SQL into individual statements
    // Remove comments and empty lines, then split by semicolons
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip empty statements
      if (!statement || statement.length < 10) continue

      try {
        // Execute using Supabase RPC (we'll use a workaround since Supabase JS doesn't support raw SQL)
        // Instead, we'll use the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ sql: statement }),
        })

        if (!response.ok) {
          // Try alternative: use pg REST API if available
          // For now, we'll show the statement and let user know
          console.log(`⚠️  Statement ${i + 1} needs manual execution (DDL statements require direct database access)`)
          console.log(`   ${statement.substring(0, 80)}...`)
        } else {
          successCount++
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }
      } catch (error) {
        errorCount++
        console.error(`❌ Error executing statement ${i + 1}:`, error instanceof Error ? error.message : error)
      }
    }

    console.log('\n📊 Summary:')
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   ⚠️  Note: DDL statements (CREATE TABLE, CREATE FUNCTION, etc.) require direct database access`)
    console.log('\n💡 Recommendation:')
    console.log('   Run the SQL file directly in Supabase Dashboard:')
    console.log('   1. Go to https://supabase.com/dashboard')
    console.log('   2. Select your project')
    console.log('   3. Go to SQL Editor')
    console.log('   4. Copy and paste the contents of supabase-setup.sql')
    console.log('   5. Click "Run" to execute\n')

  } catch (error) {
    console.error('❌ Error reading or executing SQL file:', error)
    process.exit(1)
  }
}

// Alternative: Use Supabase Management API or direct PostgreSQL connection
// For now, provide instructions
console.log('📝 Supabase SQL Setup Script\n')
console.log('⚠️  Note: Supabase JS client cannot execute DDL statements directly.')
console.log('   This script will provide instructions for manual execution.\n')

runSQLSetup().catch(console.error)

