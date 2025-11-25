# Supabase Setup Guide

This guide will help you set up your Supabase database for Anyone Pay.

## Prerequisites

- A Supabase account ([Sign up here](https://supabase.com))
- A Supabase project created

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: `anyone-pay` (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for project to be provisioned (~2 minutes)

## Step 2: Enable pgvector Extension

1. In your Supabase project dashboard, go to **Database** → **Extensions**
2. Search for `vector`
3. Click the toggle to **Enable** the `vector` extension
4. Wait for it to activate

## Step 3: Run SQL Setup

### Option A: Using Supabase Dashboard (Recommended)

1. Go to **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase-setup.sql` from this project
4. Copy the entire file contents
5. Paste into the SQL Editor
6. Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`)

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project (get project ref from Supabase dashboard URL)
supabase link --project-ref your-project-ref

# Create migration
supabase migration new setup_payment_services

# Copy SQL to migration file
cp supabase-setup.sql supabase/migrations/[timestamp]_setup_payment_services.sql

# Apply migration
supabase db push
```

## Step 4: Verify Setup

Run this query in SQL Editor to verify:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payment_services', 'data_drops');

-- Check function
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'match_services';

-- Check extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

You should see:
- ✅ 2 tables: `payment_services`, `data_drops`
- ✅ 1 function: `match_services`
- ✅ 1 extension: `vector`

## Step 5: Get API Keys

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (optional, for admin operations)

## Step 6: Update Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 7: Test Connection

Run the app and verify:

```bash
npm run dev
```

The app should connect to Supabase without errors.

## Troubleshooting

### Error: "extension 'vector' does not exist"
- Go to Database → Extensions
- Enable the `vector` extension manually

### Error: "permission denied"
- Make sure you're running SQL in the SQL Editor (not via API)
- SQL Editor has full database access

### Error: "relation already exists"
- This is fine! The `IF NOT EXISTS` clauses prevent errors
- Tables already exist from a previous setup

### Tables not showing up
- Refresh the Supabase dashboard
- Check the SQL Editor for any error messages
- Verify you're in the correct project

## What Gets Created

### Tables

1. **payment_services**
   - Stores payment service definitions
   - Includes vector embeddings for semantic search
   - Fields: `id`, `name`, `keywords`, `amount`, `currency`, `resource_key`, `contract_id`, `chain`, `description`, `active`, `embedding`

2. **data_drops**
   - Stores encrypted data drop information
   - Links to payment services
   - Fields: `id`, `service_id`, `resource_key`, `contract_id`, `encrypted_data`, `required_payment_amount`, `required_payment_token`, `intent_type`, `action`, `private_key_encrypted`

### Functions

1. **match_services**
   - Performs semantic search using vector similarity
   - Parameters: `query_embedding`, `match_threshold`, `match_count`
   - Returns matching services with similarity scores

### Indexes

- Vector similarity index on `payment_services.embedding`
- Index on `data_drops.resource_key` for fast lookups
- Index on active services for filtering

## Next Steps

After setup is complete:

1. ✅ Verify all tables and functions exist
2. ✅ Add environment variables to `.env.local`
3. ✅ Test the application
4. ✅ Create your first payment service!

## Support

If you encounter issues:
- Check Supabase logs in Dashboard → Logs
- Review SQL Editor for error messages
- Verify all environment variables are set correctly
