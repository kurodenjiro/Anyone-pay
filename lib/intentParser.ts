// Intent parser - calls Next.js API route

interface ParsedIntent {
  type: string
  amount?: string
  redirectUrl?: string
  metadata?: Record<string, any>
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
      amount: data.amount,
      redirectUrl: data.redirect_url,
      metadata: data.metadata,
    }
  } catch (error) {
    console.error('Error parsing intent:', error)
    
    // Fallback to local parsing if API fails
    return parseIntentFallback(query)
  }
}

// Fallback parser (used if API is unavailable)
function parseIntentFallback(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase()

  // Weather forecast intent
  if (lowerQuery.includes('weather') || lowerQuery.includes('forecast')) {
    const locationMatch = query.match(/(?:for|in|at)\s+([A-Za-z\s]+)/i)
    const location = locationMatch ? locationMatch[1].trim() : 'Tokyo'
    const coords = { lat: 35.6895, lon: 139.6917 }
    
    return {
      type: 'weather_forecast',
      amount: '0.02',
      redirectUrl: `https://api.openweathermap.org/data/2.5/onecall?lat=${coords.lat}&lon=${coords.lon}&appid=PREMIUM_TOKEN&access=intent-${Date.now()}`,
      metadata: { location, coords },
    }
  }

  // Image generation intent
  if (lowerQuery.includes('image') || lowerQuery.includes('generate') || lowerQuery.includes('dragon')) {
    return {
      type: 'image_generation',
      amount: '0.05',
      redirectUrl: `https://api.groq.com/v1/images/generations?access=intent-${Date.now()}`,
      metadata: { prompt: query },
    }
  }

  // Swap intent
  if (lowerQuery.includes('swap') || lowerQuery.includes('convert')) {
    const amountMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:near|n)/i)
    const amount = amountMatch ? amountMatch[1] : '2'
    
    return {
      type: 'swap',
      amount,
      redirectUrl: '',
      metadata: { from: 'NEAR', to: 'USDC', amount },
    }
  }

  // Buy intent
  if (lowerQuery.includes('buy') || lowerQuery.includes('milk tea') || lowerQuery.includes('tea')) {
    return {
      type: 'purchase',
      amount: '0.1',
      redirectUrl: `https://anyone-pay.vercel.app/receipt?item=milk-tea&token=intent-${Date.now()}`,
      metadata: { item: 'Large Milk Tea' },
    }
  }

  // Default intent
  return {
    type: 'generic',
    amount: '0.1',
    redirectUrl: `https://anyone-pay.vercel.app/content?token=intent-${Date.now()}`,
    metadata: { query },
  }
}

