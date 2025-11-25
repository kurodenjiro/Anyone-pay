// Supabase client for storing payment services
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using in-memory storage as fallback.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Service table structure:
// CREATE TABLE payment_services (
//   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   name TEXT NOT NULL,
//   keywords TEXT[] NOT NULL,
//   amount TEXT NOT NULL,
//   currency TEXT NOT NULL DEFAULT 'USD',
//   url TEXT NOT NULL,
//   chain TEXT NOT NULL,
//   description TEXT,
//   active BOOLEAN DEFAULT true,
//   embedding vector(1536), -- For OpenAI embeddings
//   created_at TIMESTAMP DEFAULT NOW(),
//   updated_at TIMESTAMP DEFAULT NOW()
// );

// Enable pgvector extension:
// CREATE EXTENSION IF NOT EXISTS vector;

// Create index for vector similarity search:
// CREATE INDEX ON payment_services USING ivfflat (embedding vector_cosine_ops);


