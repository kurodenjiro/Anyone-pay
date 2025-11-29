import { NextRequest, NextResponse } from 'next/server'
import { createSessionId } from '@/lib/session'

/**
 * Create a new session for tracking swap requests
 * Returns a unique sessionId that can be used in quote requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intentId } = body

    // Generate sessionId using utility function
    const sessionId = createSessionId(intentId)

    console.log('Created session:', sessionId)

    return NextResponse.json({
      success: true,
      sessionId,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create session', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

