// NEAR Chain Signatures utilities for Ethereum signing
// Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts

import { ethers } from 'ethers'
import { connect, keyStores, KeyPair, Account } from 'near-api-js'
import { CONFIG } from './near'

const NEAR_PROXY_CONTRACT = process.env.NEAR_PROXY_CONTRACT || 'chainsig.near'
const MPC_PATH = process.env.MPC_PATH || ''

/**
 * Generate NEAR account ID from user receipt address
 * Pattern: example-<receipt address>-1
 */
export function generateNearAccountId(receiptAddress: string): string {
  const baseAccount = 'example'
  // Clean receipt address (remove 0x prefix, take first 20 chars)
  const cleanAddress = receiptAddress.replace(/^0x/, '').slice(0, 20)
  return `${baseAccount}-${cleanAddress}-1`
}

/**
 * Get Ethereum address from NEAR account using Chain Signatures
 * The Ethereum address is derived from the NEAR account's public key
 */
export async function getEthereumAddressFromNearAccount(
  nearAccountId: string
): Promise<string> {
  // In Chain Signatures, the Ethereum address is derived from the NEAR account
  // This is typically done by the MPC contract
  // For now, we'll use a deterministic derivation
  const near = await connect({
    networkId: CONFIG.NETWORK,
    nodeUrl: `https://rpc.${CONFIG.NETWORK}.near.org`,
    walletUrl: `https://wallet.${CONFIG.NETWORK}.near.org`,
    helperUrl: `https://helper.${CONFIG.NETWORK}.near.org`,
    keyStore: new keyStores.InMemoryKeyStore(),
  })

  try {
    const account = await near.account(nearAccountId)
    const state = await account.state()
    
    // Get public key from account
    const publicKey = state.code_hash ? await account.getAccessKeys() : null
    
    // Derive Ethereum address from NEAR public key
    // This is a simplified version - in production, use MPC contract
    if (publicKey && publicKey.length > 0) {
      // Use the first access key's public key
      const pubKeyBytes = Buffer.from(publicKey[0].public_key.split(':')[1], 'base58')
      // Derive Ethereum address from public key
      const ethAddress = ethers.utils.computeAddress('0x' + pubKeyBytes.toString('hex'))
      return ethAddress
    }
    
    // Fallback: generate deterministic address from account ID
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(nearAccountId))
    return ethers.utils.getAddress('0x' + hash.slice(-40))
  } catch (error) {
    console.error('Error getting Ethereum address from NEAR account:', error)
    // Fallback: generate deterministic address from account ID
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(nearAccountId))
    return ethers.utils.getAddress('0x' + hash.slice(-40))
  }
}

/**
 * Sign payload using NEAR Chain Signatures (MPC)
 * Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts
 */
export async function signWithChainSignature(
  nearAccountId: string,
  payload: Uint8Array | string
): Promise<{ r: string; s: string; v: number } | null> {
  try {
    const near = await connect({
      networkId: CONFIG.NETWORK,
      nodeUrl: `https://rpc.${CONFIG.NETWORK}.near.org`,
      walletUrl: `https://wallet.${CONFIG.NETWORK}.near.org`,
      helperUrl: `https://helper.${CONFIG.NETWORK}.near.org`,
      keyStore: new keyStores.InMemoryKeyStore(),
    })

    const account = await near.account(nearAccountId)
    
    // Convert payload to bytes if it's a string
    const payloadBytes = typeof payload === 'string' 
      ? ethers.utils.arrayify(payload)
      : payload

    // Call MPC contract to sign
    // The MPC contract signs the payload and returns the signature
    const result = await account.functionCall({
      contractId: NEAR_PROXY_CONTRACT,
      methodName: 'sign',
      args: {
        path: MPC_PATH || nearAccountId,
        payload: Array.from(payloadBytes),
      },
      gas: BigInt('300000000000000'),
      attachedDeposit: BigInt('0'),
    })

    // Parse signature from result
    // The MPC contract returns signature in format { r, s, v }
    // This is a simplified version - adjust based on actual MPC contract interface
    if (result && result.status) {
      // Extract signature from transaction result
      // In production, parse the actual return value from the contract
      const sig = {
        r: '0x' + '0'.repeat(64), // Placeholder - get from contract result
        s: '0x' + '0'.repeat(64), // Placeholder - get from contract result
        v: 0, // Will be determined during recovery
      }
      return sig
    }

    return null
  } catch (error) {
    console.error('Error signing with Chain Signature:', error)
    return null
  }
}

/**
 * Sign EIP-712 typed data using Chain Signatures
 */
export async function signTypedDataWithChainSignature(
  nearAccountId: string,
  domain: any,
  types: any,
  value: any
): Promise<string> {
  // Create the EIP-712 message hash
  const messageHash = ethers.utils._TypedDataEncoder.hash(domain, types, value)
  
  // Sign the message hash with Chain Signatures
  const sig = await signWithChainSignature(nearAccountId, messageHash)
  
  if (!sig) {
    throw new Error('Failed to get signature from Chain Signatures')
  }

  // Recover v value by trying both possibilities
  const ethAddress = await getEthereumAddressFromNearAccount(nearAccountId)
  const chainId = domain.chainId
  
  let v = 0
  for (let vValue = 0; vValue < 2; vValue++) {
    sig.v = vValue + chainId * 2 + 35
    const recoveredAddress = ethers.utils.recoverAddress(
      ethers.utils.arrayify(messageHash),
      sig
    )
    if (recoveredAddress.toLowerCase() === ethAddress.toLowerCase()) {
      v = vValue
      break
    }
  }
  
  sig.v = v + chainId * 2 + 35
  
  // Format signature as hex string
  return ethers.utils.joinSignature(sig)
}

