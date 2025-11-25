import { NextRequest, NextResponse } from 'next/server'
import { analyzePromptWithNearAI, detectChainForDomain } from '@/lib/nearAI'

interface ParsedIntent {
  intent_type: string
  amount: string
  redirect_url: string
  metadata: Record<string, any>
  chain?: string
  needsBridge?: boolean
  bridgeFrom?: string
  bridgeTo?: string
  aiMessage?: string  // AI response when data is incomplete
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
    
    // Use NEAR AI Cloud to analyze the prompt
    const analyzed = await analyzePromptWithNearAI(query)
    
    // Detect chain for domain if recipient is a domain
    let targetChain = analyzed.chain
    if (analyzed.recipient && analyzed.recipient.includes('.')) {
      targetChain = await detectChainForDomain(analyzed.recipient)
    }
    
    // Build redirect URL - use service URL if available, otherwise construct from recipient
    const redirectUrl = analyzed.redirectUrl || analyzed.recipient
      ? analyzed.recipient?.startsWith('http')
        ? analyzed.recipient
        : `https://${analyzed.recipient}?amount=${analyzed.amount}&token=intent-${Date.now()}`
      : `/content?token=intent-${Date.now()}`
    
    // Use service redirect URL if available
    const finalRedirectUrl = analyzed.redirectUrl || redirectUrl

    const parsed: ParsedIntent = {
      intent_type: 'payment',
      amount: analyzed.amount,
      redirect_url: finalRedirectUrl,
      metadata: {
        action: analyzed.action,
        recipient: analyzed.recipient,
        currency: analyzed.currency,
        chain: targetChain,
        needsBridge: analyzed.needsBridge,
        bridgeFrom: analyzed.bridgeFrom,
        bridgeTo: analyzed.bridgeTo || targetChain,
        serviceId: analyzed.serviceId,
        serviceName: analyzed.serviceName,
        receivingAddress: analyzed.receivingAddress,
      },
      chain: targetChain,
      needsBridge: analyzed.needsBridge,
      bridgeFrom: analyzed.bridgeFrom,
      bridgeTo: analyzed.bridgeTo || targetChain,
      aiMessage: analyzed.aiMessage,  // Include AI message if present
    }
    
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Error parsing intent:', error)
    return NextResponse.json(
      { error: 'Failed to parse intent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

