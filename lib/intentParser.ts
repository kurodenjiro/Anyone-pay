// Intent parser - calls Next.js API route

interface ParsedIntent {
  type: string
  amount?: string
  redirectUrl?: string
  redirect_url?: string
  intent_type?: string
  metadata?: Record<string, any>
  chain?: string
  needsBridge?: boolean
  bridgeTo?: string
  aiMessage?: string
}

export async function parseIntent(query: string): Promise<ParsedIntent> {
  try {
    // Call Next.js API route
    const response = await fetch('/api/parse-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Map API response to frontend format
    return {
      type: data.intent_type,
      intent_type: data.intent_type,
      amount: data.amount,
      redirectUrl: data.redirect_url,
      redirect_url: data.redirect_url,
      metadata: data.metadata,
      chain: data.chain || data.metadata?.chain,
      needsBridge: data.needsBridge ?? data.metadata?.needsBridge,
      bridgeTo: data.bridgeTo || data.metadata?.bridgeTo,
      aiMessage: data.aiMessage,
    }
  } catch (error) {
    console.error('Error parsing intent:', error)
    throw error
  }
}

