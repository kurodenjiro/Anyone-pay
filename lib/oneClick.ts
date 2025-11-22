// 1-Click SDK integration based on https://github.com/near-examples/near-intents-examples
// Note: The SDK may need to be installed from the GitHub repo directly
// For now, we'll use direct API calls

const ONE_CLICK_JWT = process.env.ONE_CLICK_JWT || ''
const ONE_CLICK_API_URL = process.env.ONE_CLICK_API_URL || 'https://api.1click.fi'

// Initialize 1-Click SDK (using direct API calls for now)
export function getOneClickSDK() {
  return {
    apiUrl: ONE_CLICK_API_URL,
    jwt: ONE_CLICK_JWT || undefined,
  }
}

// Get all available tokens across chains
export async function getAvailableTokens() {
  try {
    const sdk = getOneClickSDK()
    const response = await fetch(`${sdk.apiUrl}/tokens`, {
      headers: sdk.jwt ? { Authorization: `Bearer ${sdk.jwt}` } : {},
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error fetching tokens:', error)
    throw error
  }
}

// Get swap quote with deposit address
export async function getSwapQuote(params: {
  senderAddress: string
  recipientAddress: string
  originAsset: string
  destinationAsset: string
  amount: string
  isTest?: boolean
}) {
  try {
    const sdk = getOneClickSDK()
    const response = await fetch(`${sdk.apiUrl}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sdk.jwt ? { Authorization: `Bearer ${sdk.jwt}` } : {}),
      },
      body: JSON.stringify({
        senderAddress: params.senderAddress,
        recipientAddress: params.recipientAddress,
        originAsset: params.originAsset,
        destinationAsset: params.destinationAsset,
        amount: params.amount,
        isTest: params.isTest ?? true,
      }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error getting swap quote:', error)
    throw error
  }
}

// Check swap status
export async function checkSwapStatus(swapId: string) {
  try {
    const sdk = getOneClickSDK()
    const response = await fetch(`${sdk.apiUrl}/swap/${swapId}`, {
      headers: sdk.jwt ? { Authorization: `Bearer ${sdk.jwt}` } : {},
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error checking swap status:', error)
    throw error
  }
}

// Common asset IDs (from NEAR Intents examples)
export const ASSETS = {
  NEAR: 'nep141:wrap.near',
  USDC_NEAR: 'nep141:usdc.fakes.testnet', // Testnet
  USDC_ARB: 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near',
  ARB: 'nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near',
  ETH: 'nep141:eth-0x0000000000000000000000000000000000000000.omft.near',
}

