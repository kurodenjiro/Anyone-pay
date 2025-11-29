import { NextRequest, NextResponse } from 'next/server'
import { deleteSessionData } from '@/lib/sessionStore'
import { createSessionId } from '@/lib/session'

/**
 * Clear session data by serviceId or intentId
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceId, intentId } = body

    if (!serviceId && !intentId) {
      return NextResponse.json(
        { error: 'Missing required field: serviceId or intentId' },
        { status: 400 }
      )
    }

    // Create sessionId from serviceId or intentId
    const sessionId = createSessionId(intentId, serviceId)
    
    // Delete session data
    deleteSessionData(sessionId)
    
    console.log(`✅ Session cleared: ${sessionId} (serviceId: ${serviceId || 'N/A'}, intentId: ${intentId || 'N/A'})`)

    return NextResponse.json({
      success: true,
      message: 'Session cleared successfully',
      sessionId,
    })
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

