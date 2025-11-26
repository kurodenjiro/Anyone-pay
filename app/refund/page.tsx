'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSwapQuote, ASSETS } from '@/lib/oneClick'

function RefundForm() {
  const searchParams = useSearchParams()
  const [zcashAddress, setZcashAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [walletInfo, setWalletInfo] = useState<{ privateKey: string; publicKey: string } | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        setWalletInfo({
          privateKey: decoded.privateKey,
          publicKey: decoded.publicKey,
        })
      } catch (err) {
        setError('Invalid token')
      }
    }
  }, [searchParams])

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zcashAddress || !walletInfo) {
      setError('Please enter Zcash address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get quote for refund: USDC → Zcash swap
      // The swap will send Zcash to the user's provided address
      const quote = await getSwapQuote({
        senderAddress: walletInfo.publicKey,
        recipientAddress: zcashAddress, // User's Zcash address
        originAsset: ASSETS.USDC_BASE, // USDC on Base (from the failed swap)
        destinationAsset: ASSETS.ZCASH, // Zcash
        amount: '100000', // Example amount - should be from tracking
        dry: false,
      })

      // TODO: Send transaction using walletInfo.privateKey
      // This would use the wallet to send USDC to NEAR Intent deposit address
      // Then swap Zcash and refund to user's Zcash address

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process refund')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-8">
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Refund Request</h1>
        
        {!walletInfo ? (
          <p className="text-red-400">Invalid refund token</p>
        ) : (
          <form onSubmit={handleRefund} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Zcash Address (t-address)
              </label>
              <input
                type="text"
                value={zcashAddress}
                onChange={(e) => setZcashAddress(e.target.value)}
                placeholder="t1..."
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter your Zcash transparent address to receive the refund
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3">
                <p className="text-green-400 text-sm">
                  Refund request submitted. Your Zcash will be sent to the provided address after swap completes.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !zcashAddress}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {loading ? 'Processing...' : 'Request Refund'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

export default function RefundPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <RefundForm />
    </Suspense>
  )
}

