-- Supabase setup for payment services with semantic search
-- Run this in your Supabase SQL editor

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create payment_services table
CREATE TABLE IF NOT EXISTS payment_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  url TEXT NOT NULL, -- Direct URL to content/service
  chain TEXT NOT NULL,
  receiving_address TEXT, -- Receiving address for Base, Solana, and USDC payments
  description TEXT,
  active BOOLEAN DEFAULT true,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS payment_services_embedding_idx 
ON payment_services 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for active services
CREATE INDEX IF NOT EXISTS payment_services_active_idx 
ON payment_services (active) 
WHERE active = true;

-- Create function for semantic search
CREATE OR REPLACE FUNCTION match_services(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  keywords text[],
  amount text,
  currency text,
  url text,
  chain text,
  receiving_address text,
  description text,
  active boolean,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    payment_services.id,
    payment_services.name,
    payment_services.keywords,
    payment_services.amount,
    payment_services.currency,
    payment_services.url,
    payment_services.chain,
    payment_services.receiving_address,
    payment_services.description,
    payment_services.active,
    1 - (payment_services.embedding <=> query_embedding) as similarity
  FROM payment_services
  WHERE 
    payment_services.active = true
    AND payment_services.embedding IS NOT NULL
    AND 1 - (payment_services.embedding <=> query_embedding) > match_threshold
  ORDER BY payment_services.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_services_updated_at
  BEFORE UPDATE ON payment_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert example service (optional)
-- INSERT INTO payment_services (name, keywords, amount, currency, url, chain, description, active)
-- VALUES (
--   'Kiki Deliver Series Ticket',
--   ARRAY['kiki', 'deliver', 'series', 'ticket', 'move'],
--   '0.1',
--   'USD',
--   'https://kiki-deliver-series.com/access',
--   'ethereum',
--   'Access to Kiki Deliver Series content',
--   true
-- );

