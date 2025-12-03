// Deposit tracking store - uses Supabase when available, falls back to in-memory storage
import { supabaseServer } from './supabase-server'

interface DepositTracking {
  intentId: string
  amount: string
  recipient?: string // Original payment address from AI (for x402)
  swapWalletAddress?: string // Ethereum address from NEAR account (receives swap, signs x402)
  nearAccountId?: string // NEAR account ID for Chain Signatures (pattern: example.near + <receipt>-1)
  createdAt: number
  confirmed: boolean
  confirmedAt?: number
  swapId?: string
  intentType?: string
  chain?: string // Target chain for x402 payment
  x402Executed?: boolean // Whether x402 payment has been executed
  redirectUrl?: string // Original redirect URL for content
  txHashSubmitted?: boolean // Whether transaction hash has been submitted to speed up process
  depositTxHash?: string // Transaction hash of the deposit (if available)
  quoteData?: any // Full quote data from 1-Click API
  deadline?: string // ISO 8601 format deadline from quote
  signedPayload?: string // Signed x402 payment payload (stored after execution)
}

// In-memory store (fallback when Supabase is not available)
const depositTracking = new Map<string, DepositTracking>()

// Helper function to convert DB row to DepositTracking
function dbRowToTracking(row: any): DepositTracking {
  // Parse quote_data if it's a string (JSONB can be stored as string or object)
  let quoteData = row.quote_data
  if (typeof quoteData === 'string') {
    try {
      quoteData = JSON.parse(quoteData)
    } catch (e) {
      console.error('Error parsing quote_data:', e)
      quoteData = null
    }
  }

  return {
    intentId: row.intent_id,
    amount: row.amount,
    recipient: row.recipient,
    swapWalletAddress: row.swap_wallet_address,
    nearAccountId: row.near_account_id,
    createdAt: new Date(row.created_at).getTime(),
    confirmed: row.confirmed,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).getTime() : undefined,
    swapId: row.swap_id,
    intentType: row.intent_type,
    chain: row.chain,
    x402Executed: row.x402_executed,
    redirectUrl: row.redirect_url,
    txHashSubmitted: row.tx_hash_submitted,
    depositTxHash: row.deposit_tx_hash,
    quoteData, // JSONB field (parsed)
    deadline: row.deadline ? new Date(row.deadline).toISOString() : undefined,
    signedPayload: row.signed_payload,
  }
}

// Helper function to convert DepositTracking to DB row
function trackingToDbRow(tracking: DepositTracking, depositAddress?: string): any {
  // Safely serialize quoteData to avoid circular references
  let quoteDataForDb = null
  if (tracking.quoteData) {
    try {
      // Use JSON.stringify/parse to remove circular references and ensure it's serializable
      quoteDataForDb = JSON.parse(JSON.stringify(tracking.quoteData))
    } catch (error) {
      console.error('Error serializing quoteData:', error)
      // Store a simplified version if full serialization fails
      quoteDataForDb = {
        error: 'Failed to serialize quoteData',
        hasData: true
      }
    }
  }

  return {
    deposit_address: depositAddress, // Set by caller
    intent_id: tracking.intentId,
    amount: tracking.amount,
    recipient: tracking.recipient,
    swap_wallet_address: tracking.swapWalletAddress,
    near_account_id: tracking.nearAccountId,
    created_at: new Date(tracking.createdAt).toISOString(),
    confirmed: tracking.confirmed,
    confirmed_at: tracking.confirmedAt ? new Date(tracking.confirmedAt).toISOString() : null,
    swap_id: tracking.swapId,
    intent_type: tracking.intentType,
    chain: tracking.chain,
    x402_executed: tracking.x402Executed || false,
    redirect_url: tracking.redirectUrl,
    tx_hash_submitted: tracking.txHashSubmitted || false,
    deposit_tx_hash: tracking.depositTxHash,
    quote_data: quoteDataForDb, // Store as JSONB (Supabase handles JSON automatically)
    deadline: tracking.deadline ? new Date(tracking.deadline).toISOString() : null,
    signed_payload: tracking.signedPayload,
  }
}

export async function registerDeposit(
  depositAddress: string,
  intentId: string,
  amount: string,
  recipient?: string, // Original payment address from AI
  swapId?: string,
  intentType?: string,
  swapWalletAddress?: string, // Ethereum address from NEAR account
  nearAccountId?: string, // NEAR account ID for Chain Signatures
  chain?: string, // Target chain
  redirectUrl?: string, // Original redirect URL for content
  quoteData?: any, // Full quote data from 1-Click API
  deadline?: string // ISO 8601 format deadline from quote
) {
  const tracking: DepositTracking = {
    intentId,
    amount,
    recipient, // Original x402 payment address
    swapWalletAddress, // Ethereum address from NEAR account
    nearAccountId, // NEAR account for Chain Signatures
    createdAt: Date.now(),
    confirmed: false,
    swapId,
    intentType,
    chain,
    x402Executed: false,
    redirectUrl, // Store redirect URL
    quoteData, // Store full quote data
    deadline, // Store deadline
  }

  // Try Supabase first
  if (supabaseServer) {
    try {
      const dbRow = trackingToDbRow(tracking, depositAddress)
      console.log('📦 Storing to Supabase:', {
        depositAddress,
        hasQuoteData: !!quoteData,
        quoteDataKeys: quoteData ? Object.keys(quoteData) : [],
        deadline
      })

      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .upsert(dbRow, { onConflict: 'deposit_address' })
        .select()

      if (error) {
        console.error('❌ Error storing to Supabase:', error)
        console.error('   Error details:', JSON.stringify(error, null, 2))
        // Fall back to in-memory
        depositTracking.set(depositAddress, tracking)
        console.log('⚠️ Falling back to in-memory storage')
      } else {
        console.log('✅ Stored deposit tracking to Supabase:', depositAddress)
        console.log('   Stored data:', data ? 'Success' : 'No data returned')
        return { success: true, depositAddress }
      }
    } catch (error) {
      console.error('❌ Exception storing to Supabase:', error)
      if (error instanceof Error) {
        console.error('   Error message:', error.message)
        console.error('   Error stack:', error.stack)
      }
      // Fall back to in-memory
      depositTracking.set(depositAddress, tracking)
      console.log('⚠️ Falling back to in-memory storage due to exception')
    }
  } else {
    // Use in-memory store
    console.warn('⚠️ Supabase not configured, using in-memory storage')
    console.warn('   Set SUPABASE_SERVICE_ROLE_KEY environment variable to use Supabase')
    depositTracking.set(depositAddress, tracking)
  }

  return { success: true, depositAddress }
}

export async function getDepositTracking(depositAddress: string): Promise<DepositTracking | undefined> {
  // Try Supabase first
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .select('*')
        .eq('deposit_address', depositAddress)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching from Supabase:', error)
        // Fall back to in-memory
        return depositTracking.get(depositAddress)
      }

      if (data) {
        return dbRowToTracking(data)
      }
    } catch (error) {
      console.error('Error fetching from Supabase:', error)
      // Fall back to in-memory
      return depositTracking.get(depositAddress)
    }
  }

  // Use in-memory store
  return depositTracking.get(depositAddress)
}

export async function markDepositConfirmed(depositAddress: string) {
  const updates = {
    confirmed: true,
    confirmed_at: new Date().toISOString(),
  }

  // Try Supabase first
  if (supabaseServer) {
    try {
      const { error } = await supabaseServer
        .from('deposit_tracking')
        .update(updates)
        .eq('deposit_address', depositAddress)

      if (error) {
        console.error('Error updating Supabase:', error)
        // Fall back to in-memory
        const tracking = depositTracking.get(depositAddress)
        if (tracking) {
          tracking.confirmed = true
          tracking.confirmedAt = Date.now()
          depositTracking.set(depositAddress, tracking)
        }
        return tracking
      }
    } catch (error) {
      console.error('Error updating Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Update in-memory store
  const tracking = depositTracking.get(depositAddress)
  if (tracking) {
    tracking.confirmed = true
    tracking.confirmedAt = Date.now()
    depositTracking.set(depositAddress, tracking)
  }
  return tracking
}

export async function getAllPendingDeposits(): Promise<Array<[string, DepositTracking]>> {
  // Try Supabase first
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .select('*')
        .eq('confirmed', false)

      if (error) {
        console.error('Error fetching from Supabase:', error)
        // Fall back to in-memory
        return Array.from(depositTracking.entries()).filter(
          ([_, tracking]) => !tracking.confirmed
        )
      }

      if (data) {
        return data.map((row: any) => [row.deposit_address, dbRowToTracking(row)])
      }
    } catch (error) {
      console.error('Error fetching from Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Use in-memory store
  return Array.from(depositTracking.entries()).filter(
    ([_, tracking]) => !tracking.confirmed
  )
}

/**
 * Get deposit tracking by swap wallet address (Ethereum address)
 * Used to find the redirectUrl for content page
 */
export async function getDepositTrackingBySwapWallet(swapWalletAddress: string): Promise<DepositTracking | undefined> {
  // Try Supabase first
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .select('*')
        .eq('swap_wallet_address', swapWalletAddress)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching from Supabase:', error)
        // Fall back to in-memory
      } else if (data) {
        return dbRowToTracking(data)
      }
    } catch (error) {
      console.error('Error fetching from Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Use in-memory store
  for (const [_, tracking] of depositTracking.entries()) {
    if (tracking.swapWalletAddress?.toLowerCase() === swapWalletAddress.toLowerCase()) {
      return tracking
    }
  }
  return undefined
}

/**
 * Update deposit tracking with new fields
 */
export async function updateDepositTracking(depositAddress: string, updates: Partial<DepositTracking>) {
  // Convert updates to DB format
  const dbUpdates: any = {}
  if (updates.confirmed !== undefined) dbUpdates.confirmed = updates.confirmed
  if (updates.confirmedAt !== undefined) dbUpdates.confirmed_at = new Date(updates.confirmedAt).toISOString()
  if (updates.x402Executed !== undefined) dbUpdates.x402_executed = updates.x402Executed
  if (updates.txHashSubmitted !== undefined) dbUpdates.tx_hash_submitted = updates.txHashSubmitted
  if (updates.depositTxHash !== undefined) dbUpdates.deposit_tx_hash = updates.depositTxHash
  if (updates.quoteData !== undefined) dbUpdates.quote_data = updates.quoteData || null // Supabase handles JSON automatically
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ? new Date(updates.deadline).toISOString() : null
  if (updates.signedPayload !== undefined) dbUpdates.signed_payload = updates.signedPayload

  // Try Supabase first
  if (supabaseServer && Object.keys(dbUpdates).length > 0) {
    try {
      const { error } = await supabaseServer
        .from('deposit_tracking')
        .update(dbUpdates)
        .eq('deposit_address', depositAddress)

      if (error) {
        console.error('Error updating Supabase:', error)
        // Fall back to in-memory
      }
    } catch (error) {
      console.error('Error updating Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Update in-memory store
  const tracking = depositTracking.get(depositAddress)
  if (tracking) {
    depositTracking.set(depositAddress, { ...tracking, ...updates })
  }
  return tracking
}

/**
 * Get all deposit addresses with deadline still remaining
 * Returns deposits where deadline is in the future
 */
export async function getDepositsWithDeadlineRemaining(): Promise<Array<[string, DepositTracking]>> {
  const now = new Date().toISOString()

  // Try Supabase first
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .select('*')
        .not('deadline', 'is', null)
        .gt('deadline', now)

      if (error) {
        console.error('Error fetching from Supabase:', error)
        // Fall back to in-memory
      } else if (data) {
        return data.map((row: any) => [row.deposit_address, dbRowToTracking(row)])
      }
    } catch (error) {
      console.error('Error fetching from Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Use in-memory store
  const nowMs = Date.now()
  return Array.from(depositTracking.entries()).filter(([_, tracking]) => {
    if (!tracking.deadline) return false
    const deadlineTime = new Date(tracking.deadline).getTime()
    return deadlineTime > nowMs && !tracking.confirmed
  })
}

/**
 * Get all deposits (for cronjob)
 */
export async function getAllDeposits(): Promise<Array<[string, DepositTracking]>> {
  // Try Supabase first
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('deposit_tracking')
        .select('*')

      if (error) {
        console.error('Error fetching from Supabase:', error)
        // Fall back to in-memory
        return Array.from(depositTracking.entries())
      }

      if (data) {
        return data.map((row: any) => [row.deposit_address, dbRowToTracking(row)])
      }
    } catch (error) {
      console.error('Error fetching from Supabase:', error)
      // Fall back to in-memory
    }
  }

  // Use in-memory store
  return Array.from(depositTracking.entries())
}

