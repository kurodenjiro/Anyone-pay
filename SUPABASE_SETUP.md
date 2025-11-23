# Supabase Setup Guide

This guide will help you set up Supabase for storing payment services with AI-powered semantic search.

## Prerequisites

1. **Supabase Account**: Sign up at https://supabase.com
2. **OpenAI API Key**: Required for generating embeddings (get from https://platform.openai.com/api-keys)

## Step 1: Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Wait for the project to be fully provisioned
3. Note your project URL and anon key from Settings > API

## Step 2: Run SQL Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-setup.sql`
4. Click **Run** to execute the SQL

This will:
- Enable the `vector` extension (pgvector) for semantic search
- Create the `payment_services` table
- Create indexes for fast vector similarity search
- Create the `match_services` function for semantic search
- Set up automatic timestamp updates

## Step 3: Configure Environment Variables

Add to your `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI API Key (required for embeddings)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Step 4: Verify Setup

1. Restart your Next.js dev server
2. Try creating a service through the UI
3. The service should be saved to Supabase with an embedding

## How Semantic Search Works

1. **When creating a service**:
   - The system generates an embedding (vector) from: `name + description + keywords`
   - Stores the embedding in the `embedding` column (1536 dimensions)

2. **When searching**:
   - User query is converted to an embedding
   - Supabase finds services with similar embeddings (cosine similarity)
   - Only returns services above the similarity threshold (default: 0.7 = 70% match)
   - If no match is found above threshold, returns empty results

3. **Threshold**:
   - 0.7 = 70% similarity (strict - only very similar matches)
   - 0.5 = 50% similarity (looser - more matches)
   - Adjust in `lib/serviceRegistry.ts` `findBestService()` function

## Troubleshooting

### "Supabase not configured" warning
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart your dev server after adding env variables

### "OpenAI API key not found" warning
- Semantic search will fallback to keyword search
- Add `OPENAI_API_KEY` to `.env.local`

### No results from search
- The similarity threshold might be too high
- Try lowering the threshold in `findBestService()` (currently 0.7)
- Check that services have embeddings (should be auto-generated on creation)

### Vector extension not enabled
- Run the SQL setup script again
- Check Supabase logs for errors

## Database Schema

```sql
payment_services
├── id (UUID, primary key)
├── name (TEXT)
├── keywords (TEXT[])
├── amount (TEXT)
├── currency (TEXT)
├── url (TEXT)
├── chain (TEXT)
├── description (TEXT)
├── active (BOOLEAN)
├── embedding (vector(1536))  -- For semantic search
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## API Functions

- `match_services(query_embedding, match_threshold, match_count)` - Semantic search function
- Uses cosine similarity: `1 - (embedding <=> query_embedding)`
- Only returns results above `match_threshold`

