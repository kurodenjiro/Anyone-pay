# Manual Supabase SQL Setup Guide

Since Supabase JS client cannot execute DDL statements (CREATE TABLE, CREATE FUNCTION, etc.) directly, you need to run the SQL setup manually in the Supabase Dashboard.

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Sign in to your account
   - Select your project (or create a new one)

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy SQL Setup File**
   - Open `supabase-setup.sql` in this project
   - Copy the entire contents (Ctrl+C / Cmd+C)

4. **Paste and Run**
   - Paste the SQL into the SQL Editor
   - Click "Run" (or press Ctrl+Enter / Cmd+Enter)

5. **Verify Setup**
   - Check that tables were created:
     - `payment_services`
     - `data_drops`
   - Check that function was created:
     - `match_services`
   - Check that indexes were created

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

Or create a migration:

```bash
# Create migration
supabase migration new setup_payment_services

# Copy SQL to the migration file
cp supabase-setup.sql supabase/migrations/[timestamp]_setup_payment_services.sql

# Apply migration
supabase db push
```

## Verify Setup

After running the SQL, verify the setup:

1. **Check Tables**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('payment_services', 'data_drops');
   ```

2. **Check Function**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'match_services';
   ```

3. **Check Extension**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

## Troubleshooting

### Error: "extension 'vector' does not exist"
- Enable the pgvector extension in Supabase Dashboard:
  - Go to Database > Extensions
  - Search for "vector"
  - Click "Enable"

### Error: "permission denied"
- Make sure you're using the SQL Editor (not the API)
- The SQL Editor has full database access

### Error: "relation already exists"
- Tables already exist, which is fine
- The `IF NOT EXISTS` clauses will prevent errors

## Next Steps

After running the SQL setup:

1. ✅ Verify tables and functions exist
2. ✅ Set environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, for admin operations)
3. ✅ Test the application

