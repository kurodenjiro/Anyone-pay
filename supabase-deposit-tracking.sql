-- Supabase setup for deposit tracking
-- Run this in your Supabase SQL editor

-- Create deposit_tracking table
CREATE TABLE IF NOT EXISTS deposit_tracking (
  deposit_address TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  recipient TEXT,
  swap_wallet_address TEXT,
  near_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  swap_id TEXT,
  intent_type TEXT,
  chain TEXT,
  x402_executed BOOLEAN DEFAULT false,
  redirect_url TEXT,
  tx_hash_submitted BOOLEAN DEFAULT false,
  deposit_tx_hash TEXT,
  quote_data JSONB, -- Store full quote data from 1-Click API
  deadline TIMESTAMP WITH TIME ZONE, -- ISO 8601 format deadline from quote
  signed_payload TEXT -- Signed x402 payment payload (stored after execution)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS deposit_tracking_intent_id_idx ON deposit_tracking(intent_id);
CREATE INDEX IF NOT EXISTS deposit_tracking_swap_wallet_address_idx ON deposit_tracking(swap_wallet_address);
CREATE INDEX IF NOT EXISTS deposit_tracking_confirmed_idx ON deposit_tracking(confirmed);
CREATE INDEX IF NOT EXISTS deposit_tracking_deadline_idx ON deposit_tracking(deadline);
CREATE INDEX IF NOT EXISTS deposit_tracking_x402_executed_idx ON deposit_tracking(x402_executed);
CREATE INDEX IF NOT EXISTS deposit_tracking_created_at_idx ON deposit_tracking(created_at);

-- Create index for querying deposits with deadline remaining
CREATE INDEX IF NOT EXISTS deposit_tracking_deadline_remaining_idx 
ON deposit_tracking(deadline) 
WHERE confirmed = false AND deadline IS NOT NULL;

-- Row Level Security (RLS)
-- If using service role key on server-side, RLS is bypassed automatically
-- You can disable RLS entirely for this table if only using service role:
-- ALTER TABLE deposit_tracking DISABLE ROW LEVEL SECURITY;

-- Or enable RLS with a policy (if using anon key):
-- ALTER TABLE deposit_tracking ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON deposit_tracking
-- FOR ALL USING (true) WITH CHECK (true);

-- For server-side operations with service role key, RLS is automatically bypassed
-- So we'll leave RLS disabled by default
ALTER TABLE deposit_tracking DISABLE ROW LEVEL SECURITY;

