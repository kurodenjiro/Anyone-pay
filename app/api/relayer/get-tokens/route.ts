// Get available tokens from 1-Click API
// Based on https://github.com/near-examples/near-intents-examples
import { NextResponse } from 'next/server'
import { getAvailableTokens } from '@/lib/oneClick'

export async function GET() {
  try {
    const tokens = await getAvailableTokens()
    return NextResponse.json(tokens)
  } catch (error) {
    console.error('Error fetching tokens:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tokens', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

