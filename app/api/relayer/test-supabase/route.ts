import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Test endpoint to verify Supabase connection and table setup
 */
export async function GET(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({
        success: false,
        error: 'Supabase server client not initialized',
        message: 'Check SUPABASE_SERVICE_ROLE_KEY environment variable'
      }, { status: 500 })
    }

    // Test 1: Check if table exists
    const { data: tableData, error: tableError } = await supabaseServer
      .from('deposit_tracking')
      .select('deposit_address')
      .limit(1)

    if (tableError) {
      return NextResponse.json({
        success: false,
        error: 'Table access error',
        details: tableError.message,
        code: tableError.code,
        hint: tableError.hint
      }, { status: 500 })
    }

    // Test 2: Try to insert a test record
    const testData = {
      deposit_address: 'test-' + Date.now(),
      intent_id: 'test-intent',
      amount: '0.1',
      quote_data: { test: true, timestamp: Date.now() },
      deadline: new Date(Date.now() + 60000).toISOString()
    }

    const { data: insertData, error: insertError } = await supabaseServer
      .from('deposit_tracking')
      .upsert(testData, { onConflict: 'deposit_address' })
      .select()

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: 'Insert test failed',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        testData
      }, { status: 500 })
    }

    // Test 3: Clean up test record
    await supabaseServer
      .from('deposit_tracking')
      .delete()
      .eq('deposit_address', testData.deposit_address)

    return NextResponse.json({
      success: true,
      message: 'Supabase connection and table setup verified',
      tests: {
        tableAccess: '✅ Success',
        insertTest: '✅ Success',
        cleanup: '✅ Success'
      },
      tableExists: true,
      canInsert: true,
      canQuery: true
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

