# Supabase Deposit Tracking Setup

## Database Setup

1. Run the SQL migration in your Supabase SQL editor:
   ```sql
   -- Run: supabase-deposit-tracking.sql
   ```

2. Set environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For server-side operations
   ```

## What Gets Stored

The `deposit_tracking` table stores:
- **quoteData** (JSONB): Full quote data from 1-Click API including:
  - Quote response structure
  - Deposit address
  - Amounts (Zcash, USDC)
  - Exchange rates
  - All quote metadata
- **deadline** (TIMESTAMP): ISO 8601 format deadline from quote
- **signedPayload** (TEXT): Signed x402 payment payload (stored after cronjob executes x402)
- All other deposit tracking fields

## How It Works

1. **When deposit is registered** (`register-deposit` route):
   - Gets quote from 1-Click API
   - Stores full `quoteData` and `deadline` to Supabase
   - Falls back to in-memory storage if Supabase is not configured

2. **Cronjob** (`cronjob-check-deposits` route):
   - Queries deposits with deadline remaining from Supabase
   - Checks status using `OneClickService.getExecutionStatus`
   - Executes x402 payment if status is SUCCESS
   - Saves `signedPayload` to Supabase

3. **UI** (`check-deposit` route):
   - Retrieves deposit data from Supabase
   - Returns `signedPayload` if available
   - UI redirects to content page with signedPayload

## Fallback Behavior

If Supabase is not configured (missing env vars), the system falls back to in-memory storage. This allows the app to work without a database, but data will be lost on server restart.

## Notes

- The `quote_data` column is JSONB, so it can store complex nested objects
- Supabase automatically handles JSON serialization/deserialization
- The service role key is used for server-side operations (bypasses RLS)

