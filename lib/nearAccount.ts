// NEAR account utilities based on https://github.com/near-examples/near-intents-examples
import { connect, keyStores, KeyPair, Account } from 'near-api-js'
import { CONFIG } from './near'

export async function getNearAccount(accountId: string, privateKey?: string): Promise<Account> {
  const keyStore = new keyStores.InMemoryKeyStore()
  
  if (privateKey) {
    const keyPair = KeyPair.fromString(privateKey as any)
    await keyStore.setKey(
      CONFIG.NETWORK,
      accountId,
      keyPair
    )
  }
  
  const near = await connect({
    networkId: CONFIG.NETWORK,
    nodeUrl: `https://rpc.${CONFIG.NETWORK}.near.org`,
    walletUrl: `https://wallet.${CONFIG.NETWORK}.near.org`,
    helperUrl: `https://helper.${CONFIG.NETWORK}.near.org`,
    keyStore,
  })

  return await near.account(accountId)
}

// Send NEAR tokens to deposit address
export async function sendDeposit(
  accountId: string,
  privateKey: string,
  depositAddress: string,
  amount: string
) {
  try {
    const account = await getNearAccount(accountId, privateKey)
    
    // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
    const amountInYocto = amount.includes('.') 
      ? BigInt(Math.floor(parseFloat(amount) * 1e24))
      : BigInt(amount)

    const result = await account.sendMoney(depositAddress, amountInYocto)
    return {
      transactionHash: result.transaction.hash,
      success: true,
    }
  } catch (error) {
    console.error('Error sending deposit:', error)
    throw error
  }
}

