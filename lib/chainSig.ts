// NEAR Chain Signatures utilities for Ethereum signing
// Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts

import { ethers } from 'ethers'
import { connect, keyStores, KeyPair, Account } from 'near-api-js'
import { CONFIG } from './near'

const NEAR_PROXY_CONTRACT = process.env.NEAR_PROXY_CONTRACT || 'false'
const MPC_PATH = process.env.MPC_PATH || ''
const NEAR_PROXY_ACCOUNT_ID = process.env.NEAR_PROXY_ACCOUNT_ID
const NEAR_PROXY_PRIVATE_KEY = process.env.NEAR_PROXY_PRIVATE_KEY

// Use proxy account from env
const accountId = NEAR_PROXY_ACCOUNT_ID
// Contract ID for MPC signing (default to chainsig.near)
const contractId = process.env.NEAR_PROXY_CONTRACT_ID || 'chainsig.near'
const privateKey = NEAR_PROXY_PRIVATE_KEY
const useProxyContract = NEAR_PROXY_CONTRACT === 'true'

/**
 * Get Ethereum address from NEAR proxy account using Chain Signatures
 * The Ethereum address is derived from the MPC contract
 */
export async function getEthereumAddressFromProxyAccount(): Promise<string> {
  if (!accountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  // In Chain Signatures, the Ethereum address is derived from the MPC contract
  // For now, use a deterministic hash of the account ID
  // In production, query the MPC contract for the actual Ethereum address
  const hash = ethers.keccak256(ethers.toUtf8Bytes(accountId))
  return ethers.getAddress('0x' + hash.slice(-40))
}

/**
 * Sign payload using NEAR Chain Signatures (MPC)
 * Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts
 * 
 * When NEAR_PROXY_CONTRACT === 'true': Uses MPC contract to sign
 * Otherwise: Uses sendRawEthereumTransaction (not implemented here, use signWithChainSignatureForTx)
 */
export async function signWithChainSignature(
  payload: Uint8Array | string
): Promise<{ r: string; s: string; v: number } | null> {
  if (!accountId || !privateKey) {
    throw new Error('NEAR account ID and private key must be configured in .env')
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

    let result: any

    if (useProxyContract) {
      // Use MPC contract to sign (when NEAR_PROXY_CONTRACT === 'true')
      if (!contractId) {
        throw new Error('Contract ID must be configured when using proxy contract mode')
      }

      // Prepare arguments for proxy contract call
      // When using proxy contract, pass RLP payload (unsigned transaction)
      const args = {
        rlp_payload: typeof payload === 'string' 
          ? payload.replace('0x', '') 
          : Buffer.from(payload).toString('hex'),
        path: MPC_PATH,
        key_version: 0,
      }

      // Attached deposit (1 NEAR)
      const attachedDeposit = BigInt('1000000000000000000000000') // 1 NEAR in yoctoNEAR

      console.log('Signing with MPC contract:', {
        accountId,
        contractId,
        path: MPC_PATH,
        payloadLength: payloadArray.length,
      })

      // Call MPC contract to sign
      result = await account.functionCall({
        contractId: contractId!,
        methodName: 'sign',
        args,
        gas: BigInt('300000000000000'),
        attachedDeposit,
      })
    } else {
      // When NOT using proxy contract, we should use sendRawEthereumTransaction
      // This function should only be called when useProxyContract === true
      // For non-proxy mode, use signWithChainSignatureForTx instead
      throw new Error('signWithChainSignature should only be used when NEAR_PROXY_CONTRACT === "true". For non-proxy mode, use signWithChainSignatureForTx with a transaction object.')
    }

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

/**
 * Send raw Ethereum transaction after signing with Chain Signatures
 * Based on: https://github.com/near-examples/chainsig-script/blob/main/src/ethereum.ts
 * 
 * @param baseTx - Unsigned transaction object
 * @param sig - Signature from Chain Signatures { r, s, v }
 * @param chainId - Ethereum chain ID
 * @param rpcUrl - Ethereum RPC URL
 * @returns Transaction hash
 */
export async function sendRawEthereumTransaction(
  baseTx: {
    to: string
    nonce: number
    data?: string
    value: string | bigint
    gasLimit: number | bigint
    gasPrice: string | bigint
    chainId: number
  },
  sig: { r: string; s: string; v: number },
  chainId: number,
  rpcUrl?: string
): Promise<string> {
  // Get Ethereum provider based on chain
  const providerUrl = rpcUrl || getEthereumRpcUrl(chainId)
  const provider = new ethers.JsonRpcProvider(providerUrl)

  // Format signature for ethers v6
  const formattedSig = {
    r: sig.r,
    s: sig.s,
    v: sig.v,
  }

  // Serialize transaction with signature
  // Note: ethers v6 uses different API than v5
  const serializedTx = ethers.Transaction.from({
    to: baseTx.to,
    nonce: baseTx.nonce,
    data: baseTx.data || '0x',
    value: typeof baseTx.value === 'string' ? BigInt(baseTx.value) : baseTx.value,
    gasLimit: typeof baseTx.gasLimit === 'number' ? BigInt(baseTx.gasLimit) : baseTx.gasLimit,
    gasPrice: typeof baseTx.gasPrice === 'string' ? BigInt(baseTx.gasPrice) : baseTx.gasPrice,
    chainId: baseTx.chainId,
    ...formattedSig,
  }).serialized

  // Send raw transaction
  const hash = await provider.send('eth_sendRawTransaction', [serializedTx])
  return hash
}

/**
 * Sign transaction using Chain Signatures and send via sendRawEthereumTransaction
 * Used when NEAR_PROXY_CONTRACT !== 'true'
 * 
 * @param baseTx - Unsigned transaction object
 * @param chainId - Ethereum chain ID
 * @returns Transaction hash
 */
export async function signWithChainSignatureForTx(
  baseTx: {
    to: string
    nonce: number
    data?: string
    value: string | bigint
    gasLimit: number | bigint
    gasPrice: string | bigint
    chainId: number
  },
  chainId: number
): Promise<string> {
  if (useProxyContract) {
    throw new Error('signWithChainSignatureForTx should only be used when NEAR_PROXY_CONTRACT !== "true"')
  }

  if (!accountId || !privateKey) {
    throw new Error('NEAR account ID and private key must be configured in .env')
  }

  // Get provider URL from env or use default
  const providerUrl = getEthereumRpcUrl(chainId)
  const provider = new ethers.JsonRpcProvider(providerUrl)

  // Create hash of unsigned transaction to sign
  const unsignedTx = ethers.Transaction.from({
    to: baseTx.to,
    nonce: baseTx.nonce,
    data: baseTx.data || '0x',
    value: typeof baseTx.value === 'string' ? BigInt(baseTx.value) : baseTx.value,
    gasLimit: typeof baseTx.gasLimit === 'number' ? BigInt(baseTx.gasLimit) : baseTx.gasLimit,
    gasPrice: typeof baseTx.gasPrice === 'string' ? BigInt(baseTx.gasPrice) : baseTx.gasPrice,
    chainId: baseTx.chainId,
  }).unsignedSerialized

  const txHash = ethers.keccak256(unsignedTx)
  const payload = Array.from(ethers.getBytes(txHash))

  // Sign via NEAR MPC contract (not proxy mode)
  const keyStore = new keyStores.InMemoryKeyStore()
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

  const args = {
    request: {
      payload: payload,
      path: MPC_PATH,
      key_version: 0,
    },
  }

  const attachedDeposit = BigInt('1000000000000000000000000') // 1 NEAR

  console.log('Signing transaction via MPC (non-proxy):', {
    accountId,
    contractId,
    path: MPC_PATH,
    chainId,
  })

  const result = await account.functionCall({
    contractId: contractId!,
    methodName: 'sign',
    args,
    gas: BigInt('300000000000000'),
    attachedDeposit,
  })

  // Parse signature
  if (result && result.status && typeof result.status === 'object' && 'SuccessValue' in result.status) {
    const successValue = (result.status as any).SuccessValue
    if (!successValue) {
      throw new Error('No SuccessValue in result')
    }
    const decodedValue = Buffer.from(successValue, 'base64').toString()
    const { big_r, s: S, recovery_id } = JSON.parse(decodedValue)
    
    const r = Buffer.from(big_r.affine_point.replace('0x', ''), 'hex')
    const s = Buffer.from(S.scalar, 'hex')

    const sig = {
      r: '0x' + r.toString('hex').padStart(64, '0'),
      s: '0x' + s.toString('hex').padStart(64, '0'),
      v: recovery_id,
    }

    // Get Ethereum address to verify signature
    const ethAddress = await getEthereumAddressFromProxyAccount()
    
    // Check both v values to recover correct address
    let addressRecovered = false
    let finalV = sig.v
    for (let v = 0; v < 2; v++) {
      const testV = v + chainId * 2 + 35
      const recoveredAddress = ethers.recoverAddress(
        ethers.getBytes(txHash),
        { r: sig.r, s: sig.s, v: testV }
      )
      if (recoveredAddress.toLowerCase() === ethAddress.toLowerCase()) {
        addressRecovered = true
        finalV = testV
        break
      }
    }

    if (!addressRecovered) {
      throw new Error('Signature failed to recover correct sending address')
    }

    // Send raw transaction
    return await sendRawEthereumTransaction(baseTx, { ...sig, v: finalV }, chainId, providerUrl)
  }

  throw new Error(`Error signing: ${JSON.stringify(result)}`)
}

/**
 * Get Ethereum RPC URL based on chain ID
 * Reads from environment variables or uses defaults
 */
function getEthereumRpcUrl(chainId: number): string {
  // Check for Base network (8453) in environment
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  }

  // Other chain defaults
  const rpcUrls: Record<number, string> = {
    1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com', // Ethereum Mainnet
    11155111: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com', // Sepolia Testnet
    84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org', // Base Sepolia
  }
  
  return rpcUrls[chainId] || `https://rpc.ankr.com/eth_${chainId}`
}

