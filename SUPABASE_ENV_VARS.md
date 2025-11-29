# Supabase Environment Variables Guide

## What is SUPABASE_SERVICE_ROLE_KEY?

`SUPABASE_SERVICE_ROLE_KEY` is a **secret API key** that gives your server-side code **full access** to your Supabase database, bypassing Row Level Security (RLS) policies.

### Key Points:

1. **Server-Side Only**: This key should **NEVER** be exposed to the client/browser
2. **Full Access**: It bypasses all RLS policies and has admin-level access
3. **Required for**: Server-side operations like cronjobs, API routes, background tasks
4. **Different from Anon Key**: The anon key respects RLS, service role key does not

## Where to Find Your Service Role Key

### Step 1: Go to Supabase Dashboard
1. Visit https://app.supabase.com
2. Sign in and select your project

### Step 2: Navigate to API Settings
1. Click on **Settings** (gear icon) in the left sidebar
2. Click on **API** under Project Settings

### Step 3: Find the Service Role Key
You'll see two keys:
- **`anon` `public`** key - This is `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe for client-side)
- **`service_role` `secret`** key - This is `SUPABASE_SERVICE_ROLE_KEY` (server-side only!)

⚠️ **IMPORTANT**: The service role key is marked as "secret" - keep it secure!

## Environment Variables Setup

Create or update your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role key)
```

## Why We Need Service Role Key

In this project, we use the service role key for:

1. **Cronjob operations** - Checking deposit statuses and executing x402 payments
2. **Server-side API routes** - Storing and retrieving deposit tracking data
3. **Bypassing RLS** - Since we're doing server-side operations, we don't need RLS restrictions

## Security Best Practices

✅ **DO:**
- Store in `.env.local` (never commit to git)
- Use only in server-side code (API routes, server components)
- Add `.env.local` to `.gitignore`

❌ **DON'T:**
- Expose to client-side code
- Commit to version control
- Share publicly
- Use in browser JavaScript

## Verification

After setting the environment variables, restart your Next.js server and check the logs:

- ✅ You should see: "✅ Supabase server client initialized"
- ❌ If you see: "⚠️ Supabase service role key not found" - the key is missing or incorrect

## Testing

You can test if it's working by calling:
```bash
curl http://localhost:3000/api/relayer/test-supabase
```

This will verify:
- Supabase connection
- Table access
- Insert/query capabilities

