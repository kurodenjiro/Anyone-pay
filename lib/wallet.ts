// Utility for creating and managing Ethereum wallets for x402 payments using NEAR Chain Signatures
import { ethers } from 'ethers'
import { getEthereumAddressFromProxyAccount } from './chainSig'

/**
 * Get NEAR proxy account and Ethereum address for Chain Signatures
 * Uses proxy account from environment variables
 * @returns NEAR account ID and Ethereum address
 */
export async function generateChainSigWallet(): Promise<{ nearAccountId: string; ethAddress: string }> {
  // Get account ID from environment
  const nearAccountId = process.env.NEAR_PROXY_ACCOUNT_ID

  if (!nearAccountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  console.log('Using NEAR account for Chain Signatures:', nearAccountId)
  
  // Get Ethereum address from NEAR proxy account using Chain Signatures
  const ethAddress = await getEthereumAddressFromProxyAccount()
  
  return {
    nearAccountId,
    ethAddress,
  }
}

// USDC token addresses and chain IDs for x402
const TOKEN_CONFIG: Record<string, { address: string; chainId: number }> = {
  base: {
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    chainId: 8453,
  },
  solana: {
    address: '', // Solana uses different format
    chainId: 0,
  },
  near: {
    address: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
    chainId: 0,
  },
}

/**
 * Sign x402 payment payload using EIP-3009 (TransferWithAuthorization) with Chain Signatures
 * Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts
 * @param nearAccountId - NEAR account ID that will sign (generated from receipt address)
 * @param ethAddress - Ethereum address derived from NEAR account
 * @param quote - x402 quote from the target API (contains payTo, maxAmountRequired, deadline, nonce)
 * @param chain - Target chain (base, solana, etc.)
 * @returns Signed payload JSON string for X-PAYMENT header
 */
export async function signX402PaymentPayload(
  nearAccountId: string,
  ethAddress: string,
  quote: {
    payTo: string
    maxAmountRequired: string
    deadline: number
    nonce: string
  },
  chain: string
): Promise<string> {
  const config = TOKEN_CONFIG[chain]
  
  if (!config || !config.address) {
    throw new Error(`Unsupported chain: ${chain}`)
  }

  const amountInWei = ethers.parseUnits(quote.maxAmountRequired, 6) // USDC has 6 decimals

  const domain = {
    name: 'USD Coin',
    version: '1',
    chainId: config.chainId,
    verifyingContract: config.address,
  }

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  }

  const value = {
    from: ethAddress, // Ethereum address from NEAR account
    to: quote.payTo,
    value: amountInWei,
    validAfter: 0,
    validBefore: quote.deadline,
    nonce: ethers.zeroPadValue(ethers.toBeHex(BigInt(quote.nonce)), 32),
  }

  // Sign using Chain Signatures
  const { signTypedDataWithChainSignature } = await import('./chainSig')
  const signature = await signTypedDataWithChainSignature(domain, types, value)

  // Return payload JSON for X-PAYMENT header
  return JSON.stringify({
    type: 'EIP-3009',
    signature: signature,
    data: value,
  })
}

/**
 * Execute x402 payment by getting quote, signing, and sending to target API
 * @param nearAccountId - NEAR account ID that will sign (generated from receipt address)
 * @param ethAddress - Ethereum address derived from NEAR account
 * @param targetApiUrl - Target API URL that requires x402 payment
 * @param chain - Target chain
 * @returns Payment result with signed payload and settlement info
 */
export async function executeX402Payment(
  nearAccountId: string,
  ethAddress: string,
  targetApiUrl: string,
  chain: string
): Promise<{
  success: boolean
  signedPayload?: string
  settlementHash?: string
  data?: any
  error?: string
}> {
  try {
    // Step 1: Get x402 quote from target API
    const quoteResponse = await fetch(targetApiUrl)

    if (quoteResponse.status !== 402) {
      return {
        success: false,
        error: `Expected 402 status, got ${quoteResponse.status}`,
      }
    }

    const quote = await quoteResponse.json()
    console.log('Received x402 quote:', quote)

    // Step 2: Sign the payment payload using Chain Signatures
    const signedPayload = await signX402PaymentPayload(nearAccountId, ethAddress, quote, chain)

    // Step 3: Send signed payload back to target API
    const paymentResponse = await fetch(targetApiUrl, {
      method: 'GET',
      headers: {
        'X-PAYMENT': signedPayload,
        'Content-Type': 'application/json',
      },
    })

    if (paymentResponse.ok) {
      const data = await paymentResponse.json()
      const paymentResponseHeader = paymentResponse.headers.get('X-PAYMENT-RESPONSE')
      const settlementInfo = paymentResponseHeader ? JSON.parse(paymentResponseHeader) : {}

      return {
        success: true,
        signedPayload,
        settlementHash: settlementInfo.hash,
        data,
      }
    } else {
      const error = await paymentResponse.json()
      return {
        success: false,
        error: error.message || `Payment failed with status ${paymentResponse.status}`,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

