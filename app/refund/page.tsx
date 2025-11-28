'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSwapQuote, ASSETS } from '@/lib/oneClick'
import { getEthereumAddressFromProxyAccount } from '@/lib/chainSig'

function RefundForm() {
  const searchParams = useSearchParams()
  const [zcashAddress, setZcashAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [refundInfo, setRefundInfo] = useState<{ amount: string; chain: string; recipient: string } | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        setRefundInfo({
          amount: decoded.amount,
          chain: decoded.chain,
          recipient: decoded.recipient,
        })
      } catch (err) {
        setError('Invalid token')
      }
    }
  }, [searchParams])

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zcashAddress || !refundInfo) {
      setError('Please enter Zcash address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get derived Ethereum address from NEAR proxy account
      const ethAddress = await getEthereumAddressFromProxyAccount()
      
      // Get USDC asset ID based on chain
      let usdcAsset = ASSETS.USDC_NEAR
      if (refundInfo.chain === 'base') {
        usdcAsset = ASSETS.USDC_BASE
      } else if (refundInfo.chain === 'solana') {
        usdcAsset = ASSETS.USDC_SOLANA
      }

      // Convert amount to smallest unit (6 decimals for USDC)
      const amountInSmallestUnit = (parseFloat(refundInfo.amount) * 1e6).toString()

      // Get quote for refund: USDC → Zcash swap using NEAR Intent
      // The swap will send Zcash to the user's provided address
      const quote = await getSwapQuote({
        senderAddress: 'anyone-pay.near',
        recipientAddress: zcashAddress, // User's Zcash address
        originAsset: usdcAsset, // USDC on target chain (from the failed swap)
        destinationAsset: ASSETS.ZCASH, // Zcash
        amount: amountInSmallestUnit,
        dry: false,
      })

      // Use NEAR Intent to transfer USDC from derived Ethereum address
      // The NEAR Intent will handle the transfer and swap
      const refundResponse = await fetch('/api/relayer/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ethAddress, // Derived Ethereum address (has the USDC)
          zcashAddress, // User's Zcash address
          amount: refundInfo.amount,
          chain: refundInfo.chain,
          depositAddress: quote.depositAddress || quote.quote?.depositAddress || quote.address,
        }),
      })

      if (!refundResponse.ok) {
        const errorData = await refundResponse.json()
        throw new Error(errorData.error || 'Failed to process refund')
      }

      const refundData = await refundResponse.json()
      console.log('Refund initiated:', refundData)

      if (refundData.success) {
        setSuccess(true)
        // Show success message with instructions
        setTimeout(() => {
          alert(`Refund initiated! ${refundData.instructions || 'Please complete the transfer to process the refund.'}`)
        }, 100)
      } else {
        throw new Error(refundData.error || 'Failed to initiate refund')
      }
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
        
        {!refundInfo ? (
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
                  Refund request submitted. The system will transfer USDC from the derived Ethereum address and swap to Zcash, sending it to your provided address.
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

