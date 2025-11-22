import { NextResponse } from 'next/server'
import { CONFIG } from '@/lib/near'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    network: CONFIG.NETWORK,
    contract: CONFIG.CONTRACT_ID,
    intentsContract: CONFIG.INTENTS_CONTRACT,
    timestamp: new Date().toISOString(),
  })
}

