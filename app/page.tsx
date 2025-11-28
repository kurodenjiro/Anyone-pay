'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AmbientBackground } from '@/components/AmbientBackground'
import { FloatingInput } from '@/components/FloatingInput'
import { IntentsQR } from '@/components/IntentsQR'
import { WalletProvider } from '@/components/WalletProvider'
import { CreateServiceModal } from '@/components/CreateServiceModal'
import { ServicesList } from '@/components/ServicesList'
import { parseIntent } from '@/lib/intentParser'

export default function Home() {
  return (
    <WalletProvider>
      <Suspense fallback={
        <main className="relative min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }>
        <HomeContent />
      </Suspense>
    </WalletProvider>
  )
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showInput, setShowInput] = useState(false)
  const [query, setQuery] = useState('')
  const [intentData, setIntentData] = useState<{
    type: string
    depositAddress: string
    amount: string
    redirectUrl: string
    chain?: string
    needsBridge?: boolean
    bridgeFrom?: string
    bridgeTo?: string
    serviceName?: string
    receivingAddress?: string
    currency?: string
    aiMessage?: string
    quoteWaitingTimeMs?: number
  } | null>(null)
  const [depositConfirmed, setDepositConfirmed] = useState(false)
  const [showCreateService, setShowCreateService] = useState(false)
  const [servicesKey, setServicesKey] = useState(0) // Force re-render when service is created
  const [isLoading, setIsLoading] = useState(false) // Loading state for prompt processing
  const [pollingStatus, setPollingStatus] = useState<string | null>(null) // Current polling status
  const [pollingAttempt, setPollingAttempt] = useState(0) // Current polling attempt number
  const [countdown, setCountdown] = useState<number | null>(null) // Countdown after deposit address creation
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null) // Time estimate from swap status
  const [x402Status, setX402Status] = useState<string | null>(null) // x402 payment status
  const [redirectInfo, setRedirectInfo] = useState<{ url?: string; message?: string } | null>(null) // Redirect information

  useEffect(() => {
    // Check if service ID is in URL
    const serviceId = searchParams.get('service')
    const promptFromUrl = searchParams.get('prompt')
    
    if (serviceId && !intentData) {
      // Load service from URL
      loadServiceFromId(serviceId)
    } else if (promptFromUrl && !intentData && !query) {
      // Load prompt from URL - will be handled by handleSubmit when component is ready
      setQuery(promptFromUrl)
      setShowInput(true)
    } else if (!intentData && !promptFromUrl && !serviceId) {
      // Auto-show input after a brief delay for first load (only if no intent data)
      const timer = setTimeout(() => {
        setShowInput(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, intentData, query])
  
  // Handle prompt from URL after query is set
  useEffect(() => {
    const promptFromUrl = searchParams.get('prompt')
    if (promptFromUrl && query === promptFromUrl && !intentData && !isLoading) {
      // Auto-submit the prompt from URL
      handleSubmit(promptFromUrl).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchParams])

  const loadServiceFromId = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/services?id=${serviceId}`)
      const fullService = await response.json()
      
      // Create intent with service data
      const amount = fullService.amount || '0.1'
      
      // Ensure receivingAddress is present
      if (!fullService.receivingAddress) {
        throw new Error('Service missing receiving address')
      }
      
      const { depositAddress, intentId, quoteWaitingTimeMs, zcashAmount } = await generateDepositAddress(
        'payment',
        amount,
        {
          type: 'payment',
          amount,
          redirectUrl: fullService.url,
          chain: fullService.chain,
          metadata: {
            serviceId: fullService.id,
            serviceName: fullService.name,
            chain: fullService.chain,
            receivingAddress: fullService.receivingAddress, // Ensure this is included
          }
        }
      )
      
      setIntentData({
        type: 'payment',
        depositAddress,
        amount: zcashAmount || amount, // Use Zcash amount if available, otherwise fallback to USDC amount
        redirectUrl: fullService.url,
        chain: fullService.chain,
        needsBridge: true,
        bridgeFrom: 'zcash',
        bridgeTo: fullService.chain,
        serviceName: fullService.name,
        receivingAddress: fullService.receivingAddress,
        currency: fullService.currency,
        quoteWaitingTimeMs,
      })
      // Start countdown after deposit address is created
      if (quoteWaitingTimeMs) {
        const initialSeconds = Math.ceil(quoteWaitingTimeMs / 1000)
        setCountdown(initialSeconds)
        
        const countdownInterval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 0) {
              clearInterval(countdownInterval)
              // Start polling after countdown completes
              pollDepositConfirmation(depositAddress)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        // Start polling immediately if no countdown
        pollDepositConfirmation(depositAddress)
      }
    } catch (error) {
      console.error('Error loading service from URL:', error)
    }
  }

  // Check if payment data is complete
  const isPaymentDataComplete = (
    amount?: string,
    currency?: string,
    chain?: string,
    receivingAddress?: string
  ): boolean => {
    return !!(
      amount && 
      parseFloat(amount) > 0 &&
      currency === 'USDC' &&
      (chain === 'base' || chain === 'solana') &&
      receivingAddress &&
      receivingAddress.length > 0
    )
  }

  const handleSubmit = async (text: string) => {
    setQuery(text)
    setIsLoading(true) // Show loading state
    // Keep input visible - don't hide it
    
    // Update URL with prompt parameter
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('prompt', text)
    window.history.pushState({}, '', newUrl.toString())

    try {
      // Parse intent using Next.js API route
      const parsed = await parseIntent(text)
      const amount = parsed.amount || ''
      const currency = parsed.metadata?.currency || ''
      const chain = parsed.chain || parsed.metadata?.chain || ''
      const receivingAddress = parsed.metadata?.receivingAddress || ''
      
      // Debug logging
      console.log('Parsed intent:', {
        amount,
        currency,
        chain,
        receivingAddress,
        aiMessage: parsed.aiMessage,
        fullParsed: parsed
      })
      
      // Normalize currency to USDC if it's USDT or any USD variant
      const normalizedCurrency = (currency && (currency.toUpperCase() === 'USDT' || currency.toUpperCase().includes('USD'))) 
        ? 'USDC' 
        : currency
      
      // Check if payment data is complete (use normalized currency)
      const isComplete = isPaymentDataComplete(amount, normalizedCurrency, chain, receivingAddress)
      
      console.log('Payment completeness check:', {
        isComplete,
        amount,
        normalizedCurrency,
        chain,
        receivingAddress,
        checks: {
          hasAmount: !!(amount && parseFloat(amount) > 0),
          hasCurrency: normalizedCurrency === 'USDC',
          hasChain: chain === 'base' || chain === 'solana',
          hasAddress: !!(receivingAddress && receivingAddress.length > 0)
        }
      })
      
      // Check if there's a currency conversion message (should not block payment)
      const hasCurrencyConversion = parsed.aiMessage && parsed.aiMessage.toLowerCase().includes('converted')
      
      if (isComplete) {
        // Full payment data available - generate QR code
        // Currency conversion message is informational only, doesn't block payment
        const { depositAddress, intentId, quoteWaitingTimeMs, zcashAmount } = await generateDepositAddress(parsed.type, amount, parsed)
        
        // Target API URL is now stored in database (depositTracking) via registerDeposit
        // No need to store in localStorage anymore
        const targetApiUrl = parsed.redirect_url || parsed.redirectUrl || ''
        
        setIntentData({
          type: parsed.type,
          depositAddress,
          amount: zcashAmount || amount, // Use Zcash amount if available, otherwise fallback to USDC amount
          redirectUrl: targetApiUrl,
          chain: parsed.chain || parsed.metadata?.chain,
          needsBridge: parsed.needsBridge ?? parsed.metadata?.needsBridge,
          bridgeTo: parsed.bridgeTo || parsed.metadata?.bridgeTo,
          serviceName: parsed.metadata?.serviceName,
          receivingAddress: parsed.metadata?.receivingAddress,
          currency: normalizedCurrency || 'USDC',
          quoteWaitingTimeMs,
          // Show currency conversion message if present (informational only)
          aiMessage: hasCurrencyConversion ? parsed.aiMessage : undefined,
        })

        // Start countdown after deposit address is created
        if (quoteWaitingTimeMs) {
          const initialSeconds = Math.ceil(quoteWaitingTimeMs / 1000)
          setCountdown(initialSeconds)
          
          const countdownInterval = setInterval(() => {
            setCountdown((prev) => {
              if (prev === null || prev <= 0) {
                clearInterval(countdownInterval)
                // Start polling after countdown completes
                pollDepositConfirmation(depositAddress)
                return 0
              }
              return prev - 1
            })
          }, 1000)
        } else {
          // Start polling immediately if no countdown
          pollDepositConfirmation(depositAddress)
        }
      } else {
        // Incomplete data - show AI message
        setIntentData({
          type: parsed.intent_type || 'payment',
          depositAddress: '', // No deposit address for incomplete data
          amount: amount || '',
          redirectUrl: '',
          chain: chain || '',
          needsBridge: false,
          serviceName: parsed.metadata?.serviceName,
          receivingAddress: receivingAddress || '',
          currency: normalizedCurrency || '',
          aiMessage: parsed.aiMessage, // Only show AI response, no default fallback
        })
      }
    } catch (error) {
      console.error('Error processing intent:', error)
      // Show error message
      setIntentData({
        type: 'payment',
        depositAddress: '',
        amount: '',
        redirectUrl: '',
        chain: '',
        needsBridge: false,
        currency: '',
        aiMessage: "Sorry, I encountered an error processing your request. Please try again.",
      })
    } finally {
      setIsLoading(false) // Hide loading state
    }
  }

  const generateDepositAddress = async (
    intentType: string, 
    amount: string,
    parsed: any
  ): Promise<{ depositAddress: string; intentId: string; quoteWaitingTimeMs?: number; zcashAmount?: string }> => {
    const timestamp = Date.now()
    const intentId = `intent-${timestamp}`
    
    // Get recipient address - required for Chain Signature wallet generation
    const recipient = parsed.metadata?.receivingAddress || parsed.metadata?.to || parsed.metadata?.recipient || ''
    
    if (!recipient) {
      throw new Error('Recipient address is required to generate deposit address')
    }
    
    // Register with relayer - this will get quote from 1-Click API for USDC → Zcash
    // The API will return a real deposit address from 1-Click API
    try {
      const response = await fetch('/api/relayer/register-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId,
          intentType: 'payment', // Always use payment type
          amount,
          recipient, // Use validated recipient
          senderAddress: '', // Will be set from wallet if available
          chain: parsed.chain || parsed.metadata?.chain || 'base',
          redirectUrl: parsed.redirect_url || parsed.redirectUrl || '',
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to register deposit')
      }
      
      const data = await response.json()
      
      // Use real deposit address from 1-Click API
      if (!data.depositAddress) {
        throw new Error('No deposit address returned from 1-Click API')
      }
      
      return { 
        depositAddress: data.depositAddress, 
        intentId,
        quoteWaitingTimeMs: data.quoteWaitingTimeMs,
        zcashAmount: data.zcashAmount // Amount of Zcash user needs to deposit
      }
    } catch (error) {
      console.error('Failed to register deposit:', error)
      throw error
    }
  }

  const pollDepositConfirmation = async (address: string) => {
    const maxAttempts = 60 // 5 minutes max (60 attempts * 5 seconds = 5 minutes)
    let attempts = 0

    console.log('🔄 Starting status polling...')
    setPollingStatus('PENDING')
    setPollingAttempt(0)

    const poll = async () => {
      try {
        setPollingAttempt(attempts + 1)
        
        const response = await fetch('/api/relayer/check-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        const status = data.status || 'PENDING'
        
        // Update polling status in UI
        setPollingStatus(status)
        
        // Extract timeEstimate from swap status if available
        if (data.swapStatus?.quoteResponse?.quote?.timeEstimate) {
          const estimateSeconds = data.swapStatus.quoteResponse.quote.timeEstimate
          setTimeEstimate(estimateSeconds * 1000) // Convert to milliseconds
        }
        
        console.log(`   Current status: ${status} (attempt ${attempts + 1}/${maxAttempts})`)
        
        if (data.confirmed || status === 'SUCCESS') {
          console.log('🎉 Intent Fulfilled!')
          setPollingStatus('SUCCESS')
          
          // Execute x402 payment after swap completes
          // The swap wallet will sign and send payment to the original recipient address
          try {
            // Step 1: Sign x402 payment
            setX402Status('Signing x402 payment...')
            setRedirectInfo({ message: 'Preparing payment signature...' })
            
            const x402Response = await fetch('/api/relayer/execute-x402', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ depositAddress: address }),
            })
            
            if (!x402Response.ok) {
              console.error('x402 API error:', x402Response.status, x402Response.statusText)
              const errorText = await x402Response.text()
              console.error('Error response:', errorText)
              setX402Status('x402 payment failed')
              setRedirectInfo({ message: `Payment failed: ${x402Response.status}` })
              throw new Error(`x402 payment failed: ${x402Response.status} ${x402Response.statusText}`)
            }
            
            const x402Data = await x402Response.json()
            
            // Step 2: Get redirect URL
            setX402Status('x402 payment signed')
            setRedirectInfo({ message: 'Getting redirect URL...' })
            
            if (x402Data.success && x402Data.redirectUrl) {
              console.log('✅ x402 payment executed:', x402Data)
              
              // Step 3: Redirect information
              setX402Status('x402 payment completed')
              setRedirectInfo({ 
                url: x402Data.redirectUrl,
                message: 'Redirecting to premium content...' 
              })
              
              // Redirect to content page with signed payload
              setDepositConfirmed(true)
              setTimeout(() => {
                window.location.href = x402Data.redirectUrl
              }, 2000)
              return
            } else if (x402Data.redirectUrl) {
              // Redirect to refund page
              console.log('⚠️ x402 payment failed, redirecting to refund:', x402Data.error)
              setX402Status('x402 payment failed')
              setRedirectInfo({ 
                url: x402Data.redirectUrl,
                message: 'Redirecting to refund page...' 
              })
              setDepositConfirmed(true)
              setTimeout(() => {
                window.location.href = x402Data.redirectUrl
              }, 2000)
              return
            }
          } catch (error) {
            console.error('Error executing x402 payment:', error)
            setX402Status('x402 payment error')
            setRedirectInfo({ message: error instanceof Error ? error.message : 'Unknown error' })
          }
          
          setDepositConfirmed(true)
          // Fallback redirect
          setTimeout(() => {
            if (intentData?.redirectUrl) {
              window.location.href = intentData.redirectUrl
            }
          }, 2000)
          return // Stop polling
        }
        
        // If status is REFUNDED, stop polling
        if (status === 'REFUNDED' || status === 'FAILED') {
          console.log(`❌ Swap failed with status: ${status}`)
          setPollingStatus(status)
          return // Stop polling
        }
        
        // Continue polling if not at max attempts
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.log('⏸️ Max polling attempts reached')
          setPollingStatus('TIMEOUT')
        }
      } catch (error) {
        console.error('Error checking status:', error)
        console.log('⏳ Waiting 5 seconds before retry...')
        setPollingStatus('ERROR')
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000)
        } else {
          console.log('⏸️ Max polling attempts reached after error')
          setPollingStatus('TIMEOUT')
        }
      }
    }

    poll()
  }

  const handleClickAnywhere = () => {
    if (!showInput) {
      setShowInput(true)
    }
  }
  
  const handleNewQuery = () => {
    // Reset when user wants to start a new query
    setIntentData(null)
    setDepositConfirmed(false)
    setQuery('')
    setIsLoading(false)
    setPollingStatus(null)
    setPollingAttempt(0)
    setCountdown(null)
    setTimeEstimate(null)
    setX402Status(null)
    setRedirectInfo(null)
    
    // Clear URL parameters and go to home
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('prompt')
    newUrl.searchParams.delete('service')
    window.history.pushState({}, '', newUrl.pathname)
  }

  return (
      <main 
        className="relative min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-900"
        onClick={handleClickAnywhere}
      >
        <AmbientBackground />
        
        {/* Branding */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleNewQuery}
            className="text-4xl md:text-5xl font-bold gradient-text hover:opacity-80 transition-opacity cursor-pointer"
          >
            Anyone Pay Legend
          </button>
        </div>
        
        {/* All components in one page flow - centered and shortened */}
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 max-w-2xl mx-auto w-full pt-20">
          {/* Input - first component */}
          <div className="w-full">
            <FloatingInput
              show={showInput}
              onSubmit={handleSubmit}
              onClose={() => setShowInput(false)}
              loading={isLoading}
              value={query}
              onChange={setQuery}
            />
          </div>

          {/* Services List - show below input when no intent data */}
          {!intentData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <ServicesList
                key={servicesKey}
                onServiceClick={(service) => {
                  // Change URL to include service ID
                  router.push(`/?service=${service.id}`, { scroll: false })
                }}
              />
            </motion.div>
          )}

          {/* AI Message - show when data is incomplete OR when currency conversion happens */}
          {intentData && intentData.aiMessage && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-xl shadow-purple-500/10"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 text-lg">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm leading-relaxed">
                    {intentData.aiMessage}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* QR Code - second component (only show when payment data is complete) */}
          {intentData && intentData.depositAddress && !intentData.aiMessage && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <IntentsQR 
                depositAddress={intentData.depositAddress}
                amount={intentData.amount}
                quoteWaitingTimeMs={timeEstimate || intentData.quoteWaitingTimeMs}
              />
            </motion.div>
          )}


          {/* Countdown after deposit address creation */}
          {countdown !== null && countdown > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 shadow-xl shadow-purple-500/10"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-white">
                  Preparing deposit address... <span className="text-purple-400 font-semibold">{countdown}s</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Polling status */}
          {pollingStatus && countdown === 0 && !depositConfirmed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 shadow-xl shadow-purple-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="text-sm text-white">
                      Checking deposit status... 
                      <span className="text-purple-400 ml-2 font-semibold">
                        {pollingStatus === 'PENDING' || pollingStatus === 'PENDING_DEPOSIT' ? 'Waiting for deposit' :
                         pollingStatus === 'KNOWN_DEPOSIT_TX' ? 'Deposit detected' :
                         pollingStatus === 'PROCESSING' ? 'Processing swap' :
                         pollingStatus === 'SUCCESS' ? 'Success!' :
                         pollingStatus === 'REFUNDED' ? 'Refunded' :
                         pollingStatus === 'FAILED' ? 'Failed' :
                         pollingStatus === 'ERROR' ? 'Error' :
                         pollingStatus === 'TIMEOUT' ? 'Timeout' :
                         pollingStatus === 'INCOMPLETE_DEPOSIT' ? 'Incomplete deposit' :
                         'Checking...'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Attempt {pollingAttempt}/60
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* x402 Payment Status */}
          {x402Status && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 shadow-xl shadow-purple-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="text-sm text-white">
                      {x402Status}
                    </p>
                    {redirectInfo?.message && (
                      <p className="text-xs text-gray-400 mt-1">
                        {redirectInfo.message}
                      </p>
                    )}
                    {redirectInfo?.url && (
                      <p className="text-xs text-purple-400 mt-1 font-mono truncate max-w-md">
                        {redirectInfo.url}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Status message */}
          {depositConfirmed && !x402Status && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-green-400 text-sm flex items-center gap-2"
            >
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              Redirecting to premium content...
            </motion.div>
          )}

          {!intentData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-gray-500 text-center mt-8 space-y-4"
            >
              <div>
                <p>Click anywhere to start typing your request.</p>
                <p className="text-sm mt-2">e.g., "Pay ticket move Kiki deliver series" or "Swap 2 Zcash to USDC"</p>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowCreateService(true)}
                  className="text-purple-400 hover:text-purple-300 text-sm underline transition-colors"
                >
                  Or create a new payment service
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <CreateServiceModal
          isOpen={showCreateService}
          onClose={() => setShowCreateService(false)}
          onServiceCreated={() => {
            console.log('Service created successfully!')
            // Refresh services list
            setServicesKey(prev => prev + 1)
          }}
        />
      </main>
  )
}

