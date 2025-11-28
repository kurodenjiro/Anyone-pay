'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ContentDisplay() {
  const searchParams = useSearchParams()
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const signedPayload = searchParams.get('signedPayload')
    const address = searchParams.get('address')

    if (!signedPayload || !address) {
      setError('Missing signed payload or address')
      setLoading(false)
      return
    }

    // Fetch target API URL from database
    const fetchContent = async () => {
      try {
        // First, get the target API URL from database
        const urlResponse = await fetch(`/api/content/get-url?address=${encodeURIComponent(address)}`)
        
        if (!urlResponse.ok) {
          const errorData = await urlResponse.json()
          setError(errorData.error || 'Failed to get target API URL from database')
          setLoading(false)
          return
        }

        const urlData = await urlResponse.json()
        const targetApiUrl = urlData.redirectUrl

        if (!targetApiUrl) {
          setError('Target API URL not found in database')
          setLoading(false)
          return
        }

        // Fetch content using x402 signed payload
        const response = await fetch(targetApiUrl, {
          method: 'GET',
          headers: {
            'X-PAYMENT': decodeURIComponent(signedPayload),
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          const paymentResponseHeader = response.headers.get('X-PAYMENT-RESPONSE')
          const settlementInfo = paymentResponseHeader ? JSON.parse(paymentResponseHeader) : {}

          setContent({
            ...data,
            settlementHash: settlementInfo.hash,
            paidBy: address,
          })
        } else {
          const errorData = await response.json()
          setError(errorData.error || `Failed to fetch content: ${response.status}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [searchParams])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8">
          {content && (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">{content.title || 'Premium Content'}</h1>
                {content.settlementHash && (
                  <p className="text-sm text-gray-400">
                    Settlement Hash: <span className="font-mono text-purple-400">{content.settlementHash}</span>
                  </p>
                )}
                {content.paidBy && (
                  <p className="text-sm text-gray-400">
                    Paid by: <span className="font-mono text-purple-400">{content.paidBy}</span>
                  </p>
                )}
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-white text-lg leading-relaxed">{content.content || JSON.stringify(content, null, 2)}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default function ContentPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <ContentDisplay />
    </Suspense>
  )
}
