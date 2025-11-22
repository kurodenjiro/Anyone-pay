import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

function generateAccessToken(intentId: string): string {
  return `intent-${intentId}-${randomBytes(16).toString('hex')}`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> }
) {
  try {
    const { intentId } = await context.params

    if (!intentId) {
      return NextResponse.json(
        { error: 'Missing intentId parameter' },
        { status: 400 }
      )
    }

    const token = generateAccessToken(intentId)

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Error generating access token:', error)
    return NextResponse.json(
      { error: 'Failed to generate access token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

