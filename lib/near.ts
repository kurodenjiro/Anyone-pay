// NEAR connection utility for API routes
import { connect, keyStores, Contract, Account } from 'near-api-js'

const NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'mainnet'
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'anyone-pay.near'
const INTENTS_CONTRACT = process.env.NEXT_PUBLIC_INTENTS_CONTRACT || 'intents.near'
const X402_FACILITATOR = process.env.X402_FACILITATOR || 'x402.near'

const nearConfig = {
  networkId: NETWORK,
  nodeUrl: `https://rpc.${NETWORK}.near.org`,
  walletUrl: `https://wallet.${NETWORK}.near.org`,
  helperUrl: `https://helper.${NETWORK}.near.org`,
  explorerUrl: `https://explorer.${NETWORK}.near.org`,
}

let nearInstance: any = null
let contractInstance: any = null

export async function getNearConnection() {
  if (!nearInstance) {
    const keyStore = new keyStores.InMemoryKeyStore()
    nearInstance = await connect({ ...nearConfig, keyStore })
  }
  return nearInstance
}

export async function getContract() {
  if (!contractInstance) {
    const near = await getNearConnection()
    const account = await near.account(CONTRACT_ID)
    contractInstance = new Contract(account, CONTRACT_ID, {
      viewMethods: ['get_intent'],
      changeMethods: ['mark_funded', 'execute_x402_payment'],
      useLocalViewExecution: false,
    })
  }
  return contractInstance
}

export async function getIntentsAccount(): Promise<Account> {
  const near = await getNearConnection()
  return await near.account(INTENTS_CONTRACT)
}

export const CONFIG = {
  NETWORK,
  CONTRACT_ID,
  INTENTS_CONTRACT,
  X402_FACILITATOR,
}

