// Service Registry - stores available payment services in Supabase
// Uses AI semantic search for matching user queries

import { supabase } from './supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEAR_AI_API_KEY || '',
})

export interface PaymentService {
  id: string
  name: string
  keywords: string[]
  amount: string
  currency: string
  url: string  // Direct URL to content/service
  chain: string
  receivingAddress?: string  // Receiving address for Base, Solana, and USDC
  description?: string
  active: boolean
  embedding?: number[]
  created_at?: string
  updated_at?: string
}

/**
 * Generate embedding for a text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai.apiKey) {
    console.warn('OpenAI API key not found. Semantic search disabled.')
    return null
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

/**
 * Search for services using semantic similarity
 * Only returns services that match above threshold
 */
export async function searchServicesSemantic(query: string, threshold: number = 0.7): Promise<PaymentService[]> {
  if (!supabase) {
    console.warn('Supabase not configured. Returning empty results.')
    return []
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) {
    // Fallback to keyword search if embeddings not available
    return searchServicesKeyword(query)
  }

  try {
    // Use Supabase vector similarity search
    // This uses cosine similarity - only returns results above threshold
    const { data, error } = await supabase.rpc('match_services', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: 10,
    })

    if (error) {
      console.error('Error in semantic search:', error)
      // Fallback to keyword search
      return searchServicesKeyword(query)
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      keywords: row.keywords || [],
      amount: row.amount,
      currency: row.currency,
      url: row.url || row.resource_key, // Support both url and resource_key (legacy)
      chain: row.chain,
      receivingAddress: row.receiving_address,
      description: row.description,
      active: row.active,
    }))
  } catch (error) {
    console.error('Error searching services:', error)
    return searchServicesKeyword(query)
  }
}

/**
 * Fallback keyword-based search
 */
async function searchServicesKeyword(query: string): Promise<PaymentService[]> {
  if (!supabase) {
    return []
  }

  const queryLower = query.toLowerCase()
  const words = queryLower.split(/\s+/)

  try {
    const { data, error } = await supabase
      .from('payment_services')
      .select('*')
      .eq('active', true)

    if (error) {
      console.error('Error fetching services:', error)
      return []
    }

    if (!data) return []

    // Score services based on keyword matches
    const scored = data.map((service: any) => {
      let score = 0
      const serviceKeywords = (service.keywords || []).map((k: string) => k.toLowerCase())
      const serviceText = `${service.name} ${service.description || ''} ${serviceKeywords.join(' ')}`.toLowerCase()

      serviceKeywords.forEach((keyword: string) => {
        if (queryLower.includes(keyword) || serviceText.includes(queryLower)) {
          score += 1
        }
      })

      words.forEach((word: string) => {
        if (serviceKeywords.some((k: string) => k.includes(word) || word.includes(k))) {
          score += 0.5
        }
      })

      return { service, score }
    })
    .filter((result: any) => result.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .map((result: any) => ({
      id: result.service.id,
      name: result.service.name,
      keywords: result.service.keywords || [],
      amount: result.service.amount,
      currency: result.service.currency,
      url: result.service.url || result.service.resource_key, // Support both
      chain: result.service.chain,
      receivingAddress: result.service.receiving_address,
      description: result.service.description,
      active: result.service.active,
    }))

    return scored
  } catch (error) {
    console.error('Error in keyword search:', error)
    return []
  }
}

/**
 * Find the best matching service for a query using semantic search
 * Returns null if no match found above threshold
 */
export async function findBestService(query: string, threshold: number = 0.7): Promise<PaymentService | null> {
  const matches = await searchServicesSemantic(query, threshold)
  return matches.length > 0 ? matches[0] : null
}

/**
 * Get service by ID
 */
export async function getServiceById(id: string): Promise<PaymentService | null> {
  if (!supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('payment_services')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      name: data.name,
      keywords: data.keywords || [],
      amount: data.amount,
      currency: data.currency,
      url: data.url || data.resource_key, // Support both
      chain: data.chain,
      receivingAddress: data.receiving_address,
      description: data.description,
      active: data.active,
    }
  } catch (error) {
    console.error('Error getting service:', error)
    return null
  }
}

/**
 * Get all active services
 */
export async function getAllServices(): Promise<PaymentService[]> {
  if (!supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('payment_services')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      keywords: row.keywords || [],
      amount: row.amount,
      currency: row.currency,
      url: row.url || row.resource_key, // Support both url and resource_key (legacy)
      chain: row.chain,
      receivingAddress: row.receiving_address,
      description: row.description,
      active: row.active,
    }))
  } catch (error) {
    console.error('Error getting all services:', error)
    return []
  }
}

/**
 * Add a new service with embedding
 */
export async function addService(
  service: Omit<PaymentService, 'id' | 'embedding' | 'created_at' | 'updated_at'>
): Promise<PaymentService> {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  // Generate embedding for semantic search
  const searchText = `${service.name} ${service.description || ''} ${service.keywords.join(' ')}`
  const embedding = await generateEmbedding(searchText)

  try {
    // Insert service
    const { data, error } = await supabase
      .from('payment_services')
      .insert({
        name: service.name,
        keywords: service.keywords,
        amount: service.amount,
        currency: service.currency,
        url: service.url,
        chain: service.chain,
        receiving_address: service.receivingAddress,
        description: service.description,
        active: service.active !== false,
        embedding: embedding,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return {
      id: data.id,
      name: data.name,
      keywords: data.keywords || [],
      amount: data.amount,
      currency: data.currency,
      url: data.url || data.resource_key, // Support both
      chain: data.chain,
      receivingAddress: data.receiving_address,
      description: data.description,
      active: data.active,
    }
  } catch (error) {
    console.error('Error adding service:', error)
    throw error
  }
}

/**
 * Update a service and regenerate embedding
 */
export async function updateService(id: string, updates: Partial<PaymentService>): Promise<PaymentService | null> {
  if (!supabase) {
    return null
  }

  // If name, description, or keywords changed, regenerate embedding
  const needsNewEmbedding = updates.name || updates.description || updates.keywords

  let embedding = null
  if (needsNewEmbedding) {
    const searchText = `${updates.name || ''} ${updates.description || ''} ${(updates.keywords || []).join(' ')}`
    embedding = await generateEmbedding(searchText)
  }

  try {
    const updateData: any = {}
    if (updates.name) updateData.name = updates.name
    if (updates.keywords) updateData.keywords = updates.keywords
    if (updates.amount) updateData.amount = updates.amount
    if (updates.currency) updateData.currency = updates.currency
    if (updates.chain) updateData.chain = updates.chain
    if (updates.receivingAddress !== undefined) updateData.receiving_address = updates.receivingAddress
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.active !== undefined) updateData.active = updates.active
    if (embedding) {
      updateData.embedding = embedding
    }
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('payment_services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      name: data.name,
      keywords: data.keywords || [],
      amount: data.amount,
      currency: data.currency,
      url: data.url || data.resource_key, // Support both
      chain: data.chain,
      receivingAddress: data.receiving_address,
      description: data.description,
      active: data.active,
    }
  } catch (error) {
    console.error('Error updating service:', error)
    return null
  }
}

/**
 * Delete/deactivate a service
 */
export async function deleteService(id: string): Promise<boolean> {
  if (!supabase) {
    return false
  }

  try {
    const { error } = await supabase
      .from('payment_services')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    return !error
  } catch (error) {
    console.error('Error deleting service:', error)
    return false
  }
}
