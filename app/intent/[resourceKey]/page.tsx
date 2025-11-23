'use client'

// Client-side page for handling intent execution with X402 payment
// This page is shown when user clicks a resource key URL

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { WalletProvider } from '@/components/WalletProvider'
import { AmbientBackground } from '@/components/AmbientBackground'

export default function IntentPage() {
  const params = useParams()
  const resourceKey = params?.resourceKey as string
  const [loading, setLoading] = useState(true)
  const [intent, setIntent] = useState<any>(null)
  const [x402, setX402] = useState<any>(null)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (resourceKey) {
      loadIntent()
    }
  }, [resourceKey])

  const loadIntent = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/intent/${resourceKey}`)
      
      if (response.status === 402) {
        // Payment required
        const data = await response.json()
        setIntent(data.intent)
        setX402(data.x402)
      } else if (response.ok) {
        const data = await response.json()
        setIntent(data.intent)
        setX402(data.x402)
      } else {
        setError('Failed to load intent')
      }
    } catch (err) {
      setError('Error loading intent')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const executeIntent = async () => {
    try {
      setExecuting(true)
      setError(null)

      const response = await fetch(`/api/intent/${resourceKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'user.testnet', // In production, get from wallet
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute intent')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute intent')
      console.error(err)
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <WalletProvider>
        <main className="relative min-h-screen w-full bg-gray-950 text-white">
          <AmbientBackground />
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading intent...</p>
            </div>
          </div>
        </main>
      </WalletProvider>
    )
  }

  if (error && !intent) {
    return (
      <WalletProvider>
        <main className="relative min-h-screen w-full bg-gray-950 text-white">
          <AmbientBackground />
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadIntent}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </WalletProvider>
    )
  }

  return (
    <WalletProvider>
      <main className="relative min-h-screen w-full bg-gray-950 text-white">
        <AmbientBackground />
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6"
            >
              <h1 className="text-2xl font-bold mb-4">NEAR Intent Execution</h1>
              
              {intent && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Intent Type</p>
                    <p className="text-white">{intent.intentType}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Contract</p>
                    <p className="text-white font-mono text-sm">{intent.contractId}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Resource Key</p>
                    <p className="text-white font-mono text-xs break-all">{intent.resourceKey}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Action</p>
                    <p className="text-white">{intent.action}</p>
                  </div>
                </div>
              )}

              {x402?.required && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg"
                >
                  <h2 className="text-lg font-semibold text-yellow-400 mb-2">
                    Payment Required (X402)
                  </h2>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      Amount: <span className="font-medium">{x402.amount} {x402.token}</span>
                    </p>
                    <p className="text-sm text-gray-300">
                      Destination: <span className="font-mono text-xs">{x402.destination}</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">{x402.message}</p>
                  </div>
                </motion.div>
              )}

              {result ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 p-4 bg-green-900/20 border border-green-700/50 rounded-lg"
                >
                  <h2 className="text-lg font-semibold text-green-400 mb-2">
                    Intent Executed Successfully
                  </h2>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      Transaction: <span className="font-mono text-xs">{result.transactionHash}</span>
                    </p>
                    {result.data && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-400 mb-2">Retrieved Data:</p>
                        <pre className="text-xs bg-gray-900/50 p-3 rounded overflow-auto">
                          {result.data}
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="mt-6">
                  <button
                    onClick={executeIntent}
                    disabled={executing}
                    className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {executing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Executing Intent...
                      </span>
                    ) : x402?.required ? (
                      `Pay ${x402.amount} ${x402.token} & Execute`
                    ) : (
                      'Execute Intent'
                    )}
                  </button>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </WalletProvider>
  )
}

