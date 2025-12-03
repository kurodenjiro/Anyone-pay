'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ContentDisplay() {
  const searchParams = useSearchParams()
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serverDetails, setServerDetails] = useState<any>(null)
  const [swapStatus, setSwapStatus] = useState<string>('UNKNOWN')

  useEffect(() => {
    const address = searchParams.get('address') // Deposit address

    if (!address) {
      setError('Missing deposit address')
      setLoading(false)
      return
    }

    // Fetch target API URL and get signedPayload from database
    const fetchContent = async () => {
      try {
        // First, get the target API URL and signedPayload from database
        const urlResponse = await fetch(`/api/content/get-url?address=${encodeURIComponent(address)}`)
        
        if (!urlResponse.ok) {
          const errorData = await urlResponse.json()
          
          // Check swap status using oneClick API even on error
          let currentSwapStatus = 'UNKNOWN'
          try {
            const swapStatusResponse = await fetch(`/api/relayer/check-deposit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address }),
            })
            if (swapStatusResponse.ok) {
              const swapData = await swapStatusResponse.json()
              currentSwapStatus = swapData.swapStatus?.status || 
                                swapData.swapStatus?.executionStatus ||
                                swapData.swapStatus?.state ||
                                swapData.status ||
                                errorData.swapStatus ||
                                'UNKNOWN'
              currentSwapStatus = String(currentSwapStatus).toUpperCase()
            } else {
              currentSwapStatus = errorData.swapStatus || 'UNKNOWN'
            }
          } catch (err) {
            console.warn('Error checking swap status:', err)
            currentSwapStatus = errorData.swapStatus || 'UNKNOWN'
          }

          setSwapStatus(currentSwapStatus)
          
          // Store server details even on error
          setServerDetails({
            depositAddress: address,
            signedPayload: errorData.signedPayload || null,
            x402Executed: errorData.x402Executed || false,
            swapStatus: currentSwapStatus,
            verified: errorData.verified || false,
            targetApiUrl: errorData.redirectUrl || null,
            serviceName: errorData.serviceName || null,
          })
          
          if (urlResponse.status === 402) {
            // Payment not yet executed
            setError(errorData.message || 'Payment is still being processed. Please wait.')
          } else {
            setError(errorData.error || 'Failed to get payment information')
          }
          setLoading(false)
          return
        }

        const urlData = await urlResponse.json()
        const targetApiUrl = urlData.redirectUrl
        const signedPayload = urlData.signedPayload // Get signedPayload from database response

        // Check swap status using oneClick API
        let currentSwapStatus = 'UNKNOWN'
        try {
          const swapStatusResponse = await fetch(`/api/relayer/check-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address }),
          })
          if (swapStatusResponse.ok) {
            const swapData = await swapStatusResponse.json()
            currentSwapStatus = swapData.swapStatus?.status || 
                              swapData.swapStatus?.executionStatus ||
                              swapData.swapStatus?.state ||
                              swapData.status ||
                              'UNKNOWN'
            // Normalize to uppercase
            currentSwapStatus = String(currentSwapStatus).toUpperCase()
          }
        } catch (err) {
          console.warn('Error checking swap status:', err)
          // Use status from urlData as fallback
          currentSwapStatus = urlData.swapStatus || 'UNKNOWN'
        }

        setSwapStatus(currentSwapStatus)

        // Store server details for display (always set, even if there are errors)
        setServerDetails({
          depositAddress: urlData.depositAddress || address,
          signedPayload: signedPayload,
          x402Executed: urlData.x402Executed || false,
          swapStatus: currentSwapStatus,
          verified: urlData.verified || false,
          targetApiUrl: targetApiUrl,
          serviceName: urlData.serviceName || null,
        })

        if (!targetApiUrl) {
          setError('Target API URL not found in database')
          setLoading(false)
          return
        }

        if (!signedPayload) {
          setError('Payment not yet executed. Please wait for payment processing.')
          setLoading(false)
          return
        }

        // Verify payment was executed
        if (!urlData.verified || !urlData.x402Executed) {
          setError('Payment verification failed. Please ensure the x402 payment has been executed.')
          setLoading(false)
          return
        }

        // Fetch content using x402 signed payload (transaction hash from database)
        const response = await fetch(targetApiUrl, {
          method: 'GET',
          headers: {
            'X-PAYMENT': signedPayload, // Transaction hash from database
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
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Show server details even on error */}
          {serverDetails && (
            <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Server Details</h2>
              <div className="space-y-3">
                {serverDetails.serviceName && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Service Name</p>
                    <p className="text-sm font-semibold text-white">{serverDetails.serviceName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-400 mb-1">Deposit Address</p>
                  <p className="font-mono text-sm text-purple-400 break-all">{serverDetails.depositAddress}</p>
                </div>
                {serverDetails.signedPayload && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Transaction Hash (signedPayload)</p>
                    <p className="font-mono text-sm text-purple-400 break-all">{serverDetails.signedPayload}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">x402 Executed</p>
                    <p className={`text-sm font-semibold ${serverDetails.x402Executed ? 'text-green-400' : 'text-red-400'}`}>
                      {serverDetails.x402Executed ? 'Yes' : 'No'}
                    </p>
                  </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Swap Status</p>
                  <p className={`text-sm font-semibold ${
                    swapStatus === 'SUCCESS' ? 'text-green-400' : 
                    swapStatus === 'PENDING' ? 'text-yellow-400' : 
                    'text-red-400'
                  }`}>
                    {swapStatus}
                  </p>
                </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Payment Verified</p>
                  <p className={`text-sm font-semibold ${serverDetails.verified ? 'text-green-400' : 'text-red-400'}`}>
                    {serverDetails.verified ? 'Yes' : 'No'}
                  </p>
                </div>
                {serverDetails.verified && serverDetails.targetApiUrl && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Redirect URL</p>
                    <p className="font-mono text-sm text-blue-400 break-all">{serverDetails.targetApiUrl}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {error ? 
          ''
         :  <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 max-w-md w-full">
         <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
         <p className="text-red-400">{error}</p>
       </div>}
         
        </div>
      </main>
    )
  }

  const depositAddress = searchParams.get('address') || serverDetails?.depositAddress

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Server Details Section - Always show if we have any data */}
        {(serverDetails || depositAddress) && (
          <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Server Details</h2>
            <div className="space-y-3">
              {serverDetails?.serviceName && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Service Name</p>
                  <p className="text-sm font-semibold text-white">{serverDetails.serviceName}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-400 mb-1">Deposit Address</p>
                <p className="font-mono text-sm text-purple-400 break-all">{serverDetails?.depositAddress || depositAddress || 'N/A'}</p>
              </div>
              {serverDetails?.signedPayload && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Transaction Hash (signedPayload)</p>
                  <p className="font-mono text-sm text-purple-400 break-all">{serverDetails.signedPayload}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">x402 Executed</p>
                  <p className={`text-sm font-semibold ${serverDetails?.x402Executed ? 'text-green-400' : 'text-red-400'}`}>
                    {serverDetails?.x402Executed ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Swap Status</p>
                  <p className={`text-sm font-semibold ${
                    swapStatus === 'SUCCESS' ? 'text-green-400' : 
                    swapStatus === 'PENDING' ? 'text-yellow-400' : 
                    'text-gray-400'
                  }`}>
                    {swapStatus}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Payment Verified</p>
                <p className={`text-sm font-semibold ${serverDetails?.verified ? 'text-green-400' : 'text-red-400'}`}>
                  {serverDetails?.verified ? 'Yes' : 'No'}
                </p>
              </div>
              {serverDetails?.verified && serverDetails?.targetApiUrl && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Redirect URL</p>
                  <p className="font-mono text-sm text-blue-400 break-all">{serverDetails.targetApiUrl}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Section */}
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
