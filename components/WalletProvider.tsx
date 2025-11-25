'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { setupWalletSelector } from '@near-wallet-selector/core'
import { setupModal } from '@near-wallet-selector/modal-ui'
import { setupSender } from '@near-wallet-selector/sender'
import { providers } from 'near-api-js'

interface WalletContextType {
  selector: any
  accountId: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<any>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const network = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'mainnet'
      const networkConfig = {
        networkId: network,
        nodeUrl: `https://rpc.${network}.near.org`,
        walletUrl: `https://wallet.${network}.near.org`,
        helperUrl: `https://helper.${network}.near.org`,
        explorerUrl: `https://explorer.${network}.near.org`,
        indexerUrl: `https://api.${network}.near.org`,
      }

      const selectorInstance = await setupWalletSelector({
        network: networkConfig,
        modules: [
          setupSender(),
        ],
      })

      setSelector(selectorInstance)

      const accounts = selectorInstance.store.getState().accounts
      if (accounts.length > 0) {
        setAccountId(accounts[0].accountId)
      }

      // Auto-faucet on first connect (mainnet - removed, no faucet on mainnet)
      // Faucet is only available on testnet
    }

    init()
  }, [])

  const connect = async () => {
    if (!selector) return

    const modal = setupModal(selector, {
      contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || 'anyone-pay.near',
    })

    modal.show()

    const accounts = selector.store.getState().accounts
    if (accounts.length > 0) {
      setAccountId(accounts[0].accountId)
    }
  }

  const disconnect = () => {
    if (selector) {
      selector.wallet().signOut()
      setAccountId(null)
    }
  }

  return (
    <WalletContext.Provider value={{ selector, accountId, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}

