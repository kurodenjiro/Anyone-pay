// NEAR Chain Signatures utilities for Ethereum signing
// Based on: https://github.com/NearDeFi/chainsig.js/blob/main/examples/send-eth.ts

import { ethers } from 'ethers'
import { createPublicClient, http, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { contracts, chainAdapters } from 'chainsig.js'
import { Account } from '@near-js/accounts'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'


// For ethers v5, BigNumber is available via ethers.BigNumber
const BigNumber = ethers.BigNumber

const NEAR_PROXY_CONTRACT = process.env.NEAR_PROXY_CONTRACT || 'false'
const MPC_PATH =  'base-1'
const accountId = process.env.NEAR_PROXY_ACCOUNT_ID || ''
const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'mainnet'
const contractId = process.env.NEAR_PROXY_CONTRACT_ID || 'v1.signer'

// Create Chain Signature Contract instance
const chainSignatureContract = new contracts.ChainSignatureContract({
  networkId: networkId,
  contractId: contractId,
})

const privateKey = process.env.NEAR_PROXY_PRIVATE_KEY as KeyPairString // ed25519:3D4YudUahN...

if (!accountId) throw new Error('Setup environmental variables')

const keyPair = KeyPair.fromString(privateKey)
const signer = new KeyPairSigner(keyPair)
const provider = new JsonRpcProvider({
  url: 'https://rpc.mainnet.fastnear.com',
})

const account = new Account(accountId, provider, signer)


// Create public client for Base network
const baseRpcUrl = 'https://mainnet.base.org'
const publicClient: PublicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
} as any) as PublicClient

// Create EVM chain adapter
const evmChain = new chainAdapters.evm.EVM({
  publicClient: publicClient as any,
  contract: chainSignatureContract,
})


/**
 * Get Base network provider
 */
const getBaseProvider = () => {
  return new ethers.providers.JsonRpcProvider(
    'https://mainnet.base.org'
  )
}

/**
 * Get gas price for Base network
 * Fetches current gas price from Base RPC
 */
async function getGasPrice(): Promise<ethers.BigNumber> {
  try {
    return ethers.utils.parseUnits('0.1', 'gwei')
  } catch (error) {
    console.warn('Failed to fetch gas price from Base RPC, using fallback:', error)
    // Fallback to a reasonable gas price for Base (0.1 gwei)
    return ethers.utils.parseUnits('0.1', 'gwei')
  }
}

/**
 * Derive Ethereum address from NEAR account using Chain Signatures
 * Based on: https://github.com/NearDeFi/chainsig.js/blob/main/examples/send-eth.ts
 * Uses chainsig.js EVM adapter to derive address
 * 
 * @param derivationPath - Derivation path (e.g., "base-1", "ethereum-1"). Defaults to MPC_PATH or "base-1"
 * @returns Object with address and publicKey
 */
export async function deriveAddressAndPublicKey(
  derivationPath?: string
): Promise<{ address: string; publicKey?: string }> {
  if (!accountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  const path = 'base-1'
  
  // Use chainsig.js EVM adapter to derive address
  const result = await evmChain.deriveAddressAndPublicKey(accountId, path)
  
  return {
    address: result.address,
    publicKey: result.publicKey,
  }
}

/**
 * Get Ethereum address from NEAR proxy account using Chain Signatures
 * Based on: https://github.com/NearDeFi/chainsig.js/blob/main/examples/send-eth.ts
 * 
 * @param derivationPath - Optional derivation path (defaults to MPC_PATH or 'base-1')
 * @returns Ethereum address derived from the NEAR account and derivation path
 */
export async function getEthereumAddressFromProxyAccount(
  derivationPath?: string
): Promise<string> {
  const result = await deriveAddressAndPublicKey(derivationPath)
  return result.address
}

/**
 * Sign EIP-712 typed data using Chain Signatures
 * Based on: https://github.com/NearDeFi/chainsig.js/blob/main/examples/send-eth.ts
 * 
 * @param domain - EIP-712 domain
 * @param types - EIP-712 types
 * @param value - EIP-712 value
 * @returns Signature object with v, r, s
 */
export async function signTypedDataWithChainSignature(
  domain: any,
  types: any,
  value: any
): Promise<{ v: number; r: string; s: string }> {
  if (!accountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  // Hash the EIP-712 typed data using ethers
  const hash = ethers.utils._TypedDataEncoder.hash(domain, types, value)
  const hashBytes = ethers.utils.arrayify(hash)
  
  // Convert hash to array of numbers for chainsig.js
  const hashToSign = Array.from(hashBytes)

  console.log('Prepared typed data hash for signing:', hashToSign.length, 'bytes')

  // Sign with MPC contract using chainsig.js
  const signature = await chainSignatureContract.sign({
    payloads: [hashToSign],
    path: MPC_PATH,
    keyType: 'Ecdsa',
    signerAccount: account,
  })

  if (!signature || signature.length === 0) {
    throw new Error('Failed to get signature from MPC contract')
  }

  const sig = signature[0]
  
  // Format signature - ensure r and s have 0x prefix
  const r = sig.r.startsWith('0x') ? sig.r : `0x${sig.r}`
  const s = sig.s.startsWith('0x') ? sig.s : `0x${sig.s}`
  
  // Handle v value for EIP-712/EIP-3009
  // Extract recovery_id from various v formats
  let recoveryId: number
  if (sig.v === 0 || sig.v === 1) {
    // Direct recovery ID
    recoveryId = sig.v
  } else if (sig.v === 27 || sig.v === 28) {
    // Legacy v - extract recovery_id
    recoveryId = sig.v - 27
  } else if (sig.v >= 35) {
    // EIP-155 adjusted v - extract recovery_id: v = recovery_id + chainId * 2 + 35
    recoveryId = (sig.v - 35) % 2
  } else {
    console.warn(`Unexpected v value: ${sig.v}, using recovery_id 0`)
    recoveryId = 0
  }
  
  // For EIP-712/EIP-3009, try both formats:
  // 1. v = recovery_id + 27 (standard EIP-712)
  // 2. v = recovery_id (some contracts expect this)
  // We'll use v = recovery_id + 27 for now, but verify it works
  // If it doesn't, we may need to use just recovery_id
  const v = recoveryId + 27

  console.log('EIP-712 signature formatting:', {
    originalV: sig.v,
    recoveryId,
    finalV: v,
    r: r.substring(0, 20) + '...',
    s: s.substring(0, 20) + '...',
  })

  return {
    v,
    r,
    s,
  }
}

/**
 * Sign x402 payment transaction using Chain Signatures
 * Based on: https://github.com/NearDeFi/chainsig.js/blob/main/examples/send-eth.ts
 * 
 * @param quote - x402 quote from the target API (contains payTo, maxAmountRequired, deadline, nonce)
 * @returns Transaction hash
 */
export async function signX402TransactionWithChainSignature(
  quote: {
    payTo: string
    maxAmountRequired: string
    deadline: number
    nonce: string
  }
): Promise<string> {
  if (!accountId) {
    throw new Error('NEAR account ID not configured. Set NEAR_PROXY_ACCOUNT_ID in .env')
  }

  // Derive Ethereum address using chainsig.js
  const { address } = await evmChain.deriveAddressAndPublicKey(accountId, MPC_PATH)
  console.log('Derived Ethereum address:', address)

  const baseChainId = 8453 // Base mainnet
  const amountInWei = ethers.utils.parseUnits(quote.maxAmountRequired, 6) // USDC has 6 decimals

  // USDC contract address on Base
  const USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

  // First, sign the authorization message for transferWithAuthorization (EIP-3009/EIP-712)
  // This signature will be verified by the USDC contract
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: baseChainId,
    verifyingContract: USDC_CONTRACT,
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

  // Convert nonce to bytes32 - ensure proper formatting
  const nonceBigInt = BigNumber.from(quote.nonce)
  const nonceBytes = ethers.utils.hexZeroPad(ethers.utils.hexlify(nonceBigInt), 32)

  // Format authorization value for EIP-712
  // All numeric values should be BigNumber, addresses should be checksummed
  const authorizationValue = {
    from: ethers.utils.getAddress(address), // Checksummed address
    to: ethers.utils.getAddress(quote.payTo), // Checksummed address
    value: amountInWei, // Already BigNumber
    validAfter: BigNumber.from(0), // BigNumber
    validBefore: BigNumber.from(quote.deadline), // BigNumber
    nonce: nonceBytes, // bytes32
  }

  console.log('Signing authorization message for transferWithAuthorization...')
  console.log('Domain:', domain)
  console.log('Types:', JSON.stringify(types, null, 2))
  console.log('Value:', {
    from: authorizationValue.from,
    to: authorizationValue.to,
    value: authorizationValue.value.toString(),
    validAfter: authorizationValue.validAfter.toString(),
    validBefore: authorizationValue.validBefore.toString(),
    nonce: ethers.utils.hexlify(authorizationValue.nonce),
  })
  
  // Sign the authorization message using EIP-712
  const authSignature = await signTypedDataWithChainSignature(domain, types, authorizationValue)
  
  // Verify the signature can recover the correct address
  const hash = ethers.utils._TypedDataEncoder.hash(domain, types, authorizationValue)
  const recoveredAddress = ethers.utils.recoverAddress(hash, {
    r: authSignature.r,
    s: authSignature.s,
    v: authSignature.v,
  })
  
  console.log('Authorization signature:', {
    v: authSignature.v,
    r: authSignature.r.substring(0, 20) + '...',
    s: authSignature.s.substring(0, 20) + '...',
  })
  console.log('Recovered address from signature:', recoveredAddress)
  console.log('Expected address:', address)
  console.log('Addresses match:', recoveredAddress.toLowerCase() === address.toLowerCase())
  
  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error(`Signature verification failed: recovered ${recoveredAddress} but expected ${address}`)
  }

  // Encode function call: transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
  const iface = new ethers.utils.Interface([
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)'
  ])
  
  // Encode the function call data with the actual authorization signature
  // Note: v must be uint8, r and s must be bytes32
  // Ensure r and s are exactly 32 bytes (64 hex chars without 0x)
  const rBytes32 = ethers.utils.hexZeroPad(authSignature.r, 32)
  const sBytes32 = ethers.utils.hexZeroPad(authSignature.s, 32)
  
  // For USDC's transferWithAuthorization, v should be uint8 (0-255)
  // The contract expects v = recovery_id + 27 (so 27 or 28)
  // But some implementations might expect just recovery_id (0 or 1)
  // We'll use v = recovery_id + 27 as that's the standard for EIP-712
  const v = authSignature.v
  
  console.log('Encoding transferWithAuthorization with signature:', {
    from: address,
    to: quote.payTo,
    value: amountInWei.toString(),
    validAfter: 0,
    validBefore: quote.deadline,
    nonce: ethers.utils.hexlify(nonceBytes),
    v: v,
    r: rBytes32.substring(0, 20) + '...',
    s: sBytes32.substring(0, 20) + '...',
  })
  
  const data = iface.encodeFunctionData('transferWithAuthorization', [
    ethers.utils.getAddress(address),           // from: sender address (checksummed)
    ethers.utils.getAddress(quote.payTo),       // to: recipient address (checksummed)
    amountInWei,       // value: amount in wei
    BigNumber.from(0),                 // validAfter: can be used immediately
    BigNumber.from(quote.deadline),    // validBefore: deadline timestamp
    nonceBytes,        // nonce: unique identifier
    v,   // v: signature component from authorization (uint8, should be 27 or 28)
    rBytes32,          // r: signature component from authorization (bytes32)
    sBytes32,          // s: signature component from authorization (bytes32)
  ])

  // Get gas price
  const gasPrice = await getGasPrice()
  
  //const nonce = await provider.getTransactionCount(address)

  // Manually construct transaction since gas estimation fails with placeholder signatures
  // We'll use a reasonable gas limit for USDC transferWithAuthorization calls
  const gasLimit = BigNumber.from(150000) // Typical gas for transferWithAuthorization

  console.log('Encoding transferWithAuthorization with signatureEncoding transferWithAuthorization with signatureEncoding transferWithAuthorization with signature')
  // Use chainsig.js prepareTransactionForSigningLegacy for legacy transactions
  // This ensures the transaction format matches what finalizeTransactionSigningLegacy expects
  const { transaction: preparedTx, hashesToSign } = await evmChain.prepareTransactionForSigningLegacy({
    from: address as `0x${string}`,
    to: USDC_CONTRACT as `0x${string}`,
    value: BigInt(0),
    data: data as `0x${string}`,
    gasPrice: gasPrice.toBigInt(),
    gas: gasLimit.toBigInt(),
  })
  
  console.log('Prepared transaction:', {
    ...preparedTx,
    gas: preparedTx.gas?.toString(),
    gasPrice: preparedTx.gasPrice?.toString(),
  })
  
  // Sign with MPC contract using chainsig.js
  const signature = await chainSignatureContract.sign({
    payloads: hashesToSign,
    path: MPC_PATH,
    keyType: 'Ecdsa',
    signerAccount: account,
  })
 
  console.log('Raw signature from MPC:', JSON.stringify(signature, null, 2))

  if (!signature || signature.length === 0) {
    throw new Error('Failed to get signature from MPC contract')
  }

  
  // Use finalizeTransactionSigningLegacy for legacy transactions
  // This method properly handles legacy transaction format with v, r, s
  const signedTx = evmChain.finalizeTransactionSigningLegacy({
    transaction: preparedTx as any,
    rsvSignatures: signature,
  })

  // Broadcast transaction using public client
  const broadcastTxHash = await publicClient.sendRawTransaction({
    serializedTransaction: signedTx as `0x${string}`,
  })
  
  console.log('Transaction hash:', broadcastTxHash)
  console.log(`View on Base Explorer: https://basescan.org/tx/${broadcastTxHash}`)
  
  return broadcastTxHash
}

