// NEAR Chain Signatures utilities for Ethereum signing
// Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts

import { ethers } from 'ethers'
import { connect, keyStores, KeyPair, Account } from 'near-api-js'
import { CONFIG } from './near'

const NEAR_PROXY_CONTRACT = process.env.NEAR_PROXY_CONTRACT || 'chainsig.near'
const MPC_PATH = process.env.MPC_PATH || ''
const NEAR_PROXY_ACCOUNT_ID = process.env.NEAR_PROXY_ACCOUNT_ID
const NEAR_PROXY_PRIVATE_KEY = process.env.NEAR_PROXY_PRIVATE_KEY

// Use proxy account from env
const accountId = NEAR_PROXY_ACCOUNT_ID
const contractId = NEAR_PROXY_CONTRACT
const privateKey = NEAR_PROXY_PRIVATE_KEY

/**
 * Get Ethereum address from NEAR proxy account using Chain Signatures
 * The Ethereum address is derived from the MPC contract
 * Adds a random prefix to avoid duplicate addresses
 */
export async function getEthereumAddressFromProxyAccount(): Promise<string> {
  if (!accountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  // Generate a random prefix to ensure unique addresses
  // This prevents duplicate addresses when multiple users use the same proxy account
  const randomPrefix = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
  const uniqueKey = `${accountId}-${randomPrefix}`
  
  // In Chain Signatures, the Ethereum address is derived from the MPC contract
  // For now, use a deterministic hash of the account ID with random prefix
  // In production, query the MPC contract for the actual Ethereum address
  const hash = ethers.keccak256(ethers.toUtf8Bytes(uniqueKey))
  return ethers.getAddress('0x' + hash.slice(-40))
}

/**
 * Sign payload using NEAR Chain Signatures (MPC)
 * Based on: https://github.com/near-examples/chainsig-script/blob/main/src/near.ts
 */
export async function signWithChainSignature(
  payload: Uint8Array | string
): Promise<{ r: string; s: string; v: number } | null> {
  if (!accountId || !privateKey || !contractId) {
    throw new Error('NEAR account ID, private key, and contract ID must be configured in .env')
  }

  try {
    // Setup key store with private key
    const keyStore = new keyStores.InMemoryKeyStore()
    // Parse private key - format: "ed25519:base58string" or just the base58 string
    const keyPair = KeyPair.fromString(privateKey as any)
    await keyStore.setKey(CONFIG.NETWORK, accountId!, keyPair)

    const near = await connect({
      networkId: CONFIG.NETWORK,
      nodeUrl: `https://rpc.${CONFIG.NETWORK}.near.org`,
      walletUrl: `https://wallet.${CONFIG.NETWORK}.near.org`,
      helperUrl: `https://helper.${CONFIG.NETWORK}.near.org`,
      keyStore,
    })

    const account = await near.account(accountId!)
    
    // Convert payload to bytes if it's a string
    const payloadBytes = typeof payload === 'string' 
      ? ethers.getBytes(payload)
      : payload

    // Convert to array of numbers for NEAR contract call
    const payloadArray = Array.from(payloadBytes)

    // Prepare arguments based on proxy call mode
    const isProxyCall = NEAR_PROXY_CONTRACT === 'true'
    const args = isProxyCall
      ? {
          rlp_payload: typeof payload === 'string' ? payload.replace('0x', '') : Buffer.from(payload).toString('hex'),
          path: MPC_PATH,
          key_version: 0,
        }
      : {
          request: {
            payload: payloadArray,
            path: MPC_PATH,
            key_version: 0,
          },
        }

    // Attached deposit (1 NEAR)
    const attachedDeposit = BigInt('1000000000000000000000000') // 1 NEAR in yoctoNEAR

    console.log('Signing payload with Chain Signatures:', {
      accountId,
      contractId,
      path: MPC_PATH,
      payloadLength: payloadArray.length,
      isProxyCall,
    })

    // Call MPC contract to sign
    const result = await account.functionCall({
      contractId: contractId!,
      methodName: 'sign',
      args,
      gas: BigInt('300000000000000'),
      attachedDeposit,
    })

    // Parse signature from result
    // Based on chainsig-script: parse SuccessValue and extract r, s, recovery_id
    if (result && result.status && typeof result.status === 'object' && 'SuccessValue' in result.status) {
      const successValue = (result.status as any).SuccessValue
      if (!successValue) {
        throw new Error('No SuccessValue in result')
      }
      const decodedValue = Buffer.from(successValue, 'base64').toString()
      const { big_r, s: S, recovery_id } = JSON.parse(decodedValue)
      
      // Extract r from affine_point (remove 0x prefix)
      const r = Buffer.from(big_r.affine_point.replace('0x', ''), 'hex')
      const s = Buffer.from(S.scalar, 'hex')

      return {
        r: '0x' + r.toString('hex').padStart(64, '0'),
        s: '0x' + s.toString('hex').padStart(64, '0'),
        v: recovery_id,
      }
    }

    throw new Error(`Error signing: ${JSON.stringify(result)}`)
  } catch (error) {
    console.error('Error signing with Chain Signature:', error)
    throw error
  }
}

/**
 * Sign EIP-712 typed data using Chain Signatures
 */
export async function signTypedDataWithChainSignature(
  domain: any,
  types: any,
  value: any
): Promise<string> {
  // Create the EIP-712 message hash
  const messageHash = ethers.TypedDataEncoder.hash(domain, types, value)
  
  // Sign the message hash with Chain Signatures
  const sig = await signWithChainSignature(messageHash)
  
  if (!sig) {
    throw new Error('Failed to get signature from Chain Signatures')
  }

  // Get Ethereum address from proxy account
  const ethAddress = await getEthereumAddressFromProxyAccount()
  const chainId = domain.chainId
  
  // Use recovery_id from signature, or try both possibilities
  let v = sig.v
  if (v === 0 || v === 1) {
    // recovery_id is already set, but we need to adjust for chainId
    v = v + chainId * 2 + 35
  } else {
    // Try both possibilities to find correct v
    for (let vValue = 0; vValue < 2; vValue++) {
      const testV = vValue + chainId * 2 + 35
      const recoveredAddress = ethers.recoverAddress(
        ethers.getBytes(messageHash),
        { r: sig.r, s: sig.s, v: testV }
      )
      if (recoveredAddress.toLowerCase() === ethAddress.toLowerCase()) {
        v = testV
        break
      }
    }
  }
  
  // Format signature as hex string (r + s + v)
  const r = sig.r.replace('0x', '').padStart(64, '0')
  const s = sig.s.replace('0x', '').padStart(64, '0')
  const vHex = v.toString(16).padStart(2, '0')
  return `0x${r}${s}${vHex}`
}

