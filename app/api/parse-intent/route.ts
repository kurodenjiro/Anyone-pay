import { NextRequest, NextResponse } from 'next/server'

interface ParsedIntent {
  intent_type: string
  amount: string
  redirect_url: string
  metadata: Record<string, any>
}

// Enhanced intent parser with better location detection
function parseIntentFallback(query: string): ParsedIntent {
  const queryLower = query.toLowerCase()
  
  // Weather forecast intent
  if (queryLower.includes('weather') || queryLower.includes('forecast')) {
    let location = 'Tokyo'
    let lat = 35.6895
    let lon = 139.6917
    
    // Extract location from query
    if (queryLower.includes('tokyo')) {
      location = 'Tokyo'
      lat = 35.6895
      lon = 139.6917
    } else if (queryLower.includes('new york') || queryLower.includes('nyc')) {
      location = 'New York'
      lat = 40.7128
      lon = -74.0060
    } else if (queryLower.includes('london')) {
      location = 'London'
      lat = 51.5074
      lon = -0.1278
    } else if (queryLower.includes('paris')) {
      location = 'Paris'
      lat = 48.8566
      lon = 2.3522
    }
    
    // Extract days if mentioned
    const daysMatch = query.match(/(\d+)[-\s]?day/i)
    const days = daysMatch ? parseInt(daysMatch[1]) : 10
    
    return {
      intent_type: 'weather_forecast',
      amount: '0.02',
      redirect_url: `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=PREMIUM_TOKEN&access=intent-${Date.now()}`,
      metadata: { location, coords: { lat, lon }, days },
    }
  }
  
  // Image generation intent
  if (queryLower.includes('image') || queryLower.includes('generate') || 
      queryLower.includes('dragon') || queryLower.includes('picture') ||
      queryLower.includes('draw') || queryLower.includes('create')) {
    return {
      intent_type: 'image_generation',
      amount: '0.05',
      redirect_url: `https://api.groq.com/v1/images/generations?access=intent-${Date.now()}`,
      metadata: { prompt: query },
    }
  }
  
  // Swap intent - uses 1-Click API for real cross-chain swaps
  if (queryLower.includes('swap') || queryLower.includes('convert') || 
      queryLower.includes('exchange')) {
    const amountMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:near|n)/i)
    const amount = amountMatch ? amountMatch[1] : '2'
    
    let toToken = 'USDC'
    let destinationAsset = 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near' // USDC on Arbitrum
    if (queryLower.includes('usdt')) {
      toToken = 'USDT'
      destinationAsset = 'nep141:usdt.fakes.testnet'
    }
    if (queryLower.includes('usdc')) {
      toToken = 'USDC'
      destinationAsset = 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near'
    }
    
    return {
      intent_type: 'swap',
      amount,
      redirect_url: '',
      metadata: { 
        from: 'NEAR', 
        to: toToken, 
        amount,
        originAsset: 'nep141:wrap.near',
        destinationAsset,
      },
    }
  }
  
  // Purchase intent
  if (queryLower.includes('buy') || queryLower.includes('purchase') ||
      queryLower.includes('milk tea') || queryLower.includes('tea') ||
      queryLower.includes('coffee') || queryLower.includes('drink')) {
    let item = 'Large Milk Tea'
    if (queryLower.includes('coffee')) item = 'Large Coffee'
    if (queryLower.includes('tea')) item = 'Large Milk Tea'
    
    return {
      intent_type: 'purchase',
      amount: '0.1',
      redirect_url: `https://anyone-pay.vercel.app/receipt?item=${encodeURIComponent(item.toLowerCase().replace(/\s+/g, '-'))}&token=intent-${Date.now()}`,
      metadata: { item },
    }
  }
  
  // Default generic intent
  return {
    intent_type: 'generic',
    amount: '0.1',
    redirect_url: `https://anyone-pay.vercel.app/content?token=intent-${Date.now()}`,
    metadata: { query },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, user_account } = body
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }
    
    // In production, you could integrate NearAI LangChain here
    // For now, use the enhanced fallback parser
    const parsed = parseIntentFallback(query)
    
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error parsing intent:', error)
    return NextResponse.json(
      { error: 'Failed to parse intent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

