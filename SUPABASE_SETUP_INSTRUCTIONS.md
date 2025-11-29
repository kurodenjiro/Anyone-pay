# How to Run SQL Migration in Supabase

## Step-by-Step Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Visit https://app.supabase.com
   - Sign in to your account
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Or go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new

3. **Create New Query**
   - Click "New query" button (top right)
   - Or use the query editor that's already open

4. **Copy and Paste SQL**
   - Open the file: `supabase-deposit-tracking.sql`
   - Copy ALL the SQL code from the file
   - Paste it into the SQL Editor in Supabase

5. **Run the Query**
   - Click the "Run" button (or press `Ctrl+Enter` / `Cmd+Enter`)
   - Wait for the query to complete

6. **Verify Success**
   - You should see "Success. No rows returned" or similar message
   - Check that the table was created by going to "Table Editor" → look for `deposit_tracking` table

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push

# Or apply the SQL file directly
psql -h your-db-host -U postgres -d postgres -f supabase-deposit-tracking.sql
```

### Option 3: Using psql Command Line

```bash
# Get your connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f supabase-deposit-tracking.sql
```

## Verify the Migration

After running the SQL, verify the table was created:

1. Go to **Table Editor** in Supabase Dashboard
2. Look for `deposit_tracking` table
3. Check that it has all the columns:
   - `deposit_address` (TEXT, PRIMARY KEY)
   - `quote_data` (JSONB)
   - `deadline` (TIMESTAMP)
   - `signed_payload` (TEXT)
   - And all other columns

## Troubleshooting

### Error: "relation already exists"
- The table might already exist
- You can either:
  - Drop it first: `DROP TABLE IF EXISTS deposit_tracking;`
  - Or modify the SQL to use `CREATE TABLE IF NOT EXISTS` (already included)

### Error: "permission denied"
- Make sure you're using the correct database user
- For Supabase Dashboard, you should have the right permissions automatically
- For CLI/psql, use the connection string from Supabase Dashboard

### Error: "extension vector does not exist"
- This error is for a different table (payment_services)
- The deposit_tracking table doesn't need the vector extension
- You can ignore this if you're only setting up deposit tracking

## Next Steps

After running the migration:

1. Set environment variables in your `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Restart your Next.js server:
   ```bash
   npm run dev
   ```

3. Test by creating a deposit - it should now be stored in Supabase!

