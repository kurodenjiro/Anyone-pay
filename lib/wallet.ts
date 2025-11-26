// Utility for creating and managing Ethereum wallets for x402 payments
import { ethers } from 'ethers'

/**
 * Generate a new Ethereum wallet for receiving swapped tokens
 * This wallet will be used to sign x402 payments after swap completes
 */
export function generateEthereumWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
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
 * Sign x402 payment payload using EIP-3009 (TransferWithAuthorization)
 * @param walletPrivateKey - Private key of the wallet that received the swap
 * @param quote - x402 quote from the target API (contains payTo, maxAmountRequired, deadline, nonce)
 * @param chain - Target chain (base, solana, etc.)
 * @returns Signed payload JSON string for X-PAYMENT header
 */
export async function signX402PaymentPayload(
  walletPrivateKey: string,
  quote: {
    payTo: string
    maxAmountRequired: string
    deadline: number
    nonce: string
  },
  chain: string
): Promise<string> {
  const wallet = new ethers.Wallet(walletPrivateKey)
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
    from: wallet.address,
    to: quote.payTo,
    value: amountInWei,
    validAfter: 0,
    validBefore: quote.deadline,
    nonce: ethers.zeroPadValue(ethers.toBeHex(quote.nonce), 32),
  }

  const signature = await wallet.signTypedData(domain, types, value)

  // Return payload JSON for X-PAYMENT header
  return JSON.stringify({
    type: 'EIP-3009',
    signature: signature,
    data: value,
  })
}

/**
 * Execute x402 payment by getting quote, signing, and sending to target API
 * @param walletPrivateKey - Private key of the wallet that received the swap
 * @param targetApiUrl - Target API URL that requires x402 payment
 * @param chain - Target chain
 * @returns Payment result with signed payload and settlement info
 */
export async function executeX402Payment(
  walletPrivateKey: string,
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

    // Step 2: Sign the payment payload
    const signedPayload = await signX402PaymentPayload(walletPrivateKey, quote, chain)

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

