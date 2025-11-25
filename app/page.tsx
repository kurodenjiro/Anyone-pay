'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AmbientBackground } from '@/components/AmbientBackground'
import { FloatingInput } from '@/components/FloatingInput'
import { IntentsQR } from '@/components/IntentsQR'
import { IntentFlowDiagram } from '@/components/IntentFlowDiagram'
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
    bridgeTo?: string
    serviceName?: string
    receivingAddress?: string
    currency?: string
    aiMessage?: string
  } | null>(null)
  const [showFlow, setShowFlow] = useState(false)
  const [depositConfirmed, setDepositConfirmed] = useState(false)
  const [showCreateService, setShowCreateService] = useState(false)
  const [servicesKey, setServicesKey] = useState(0) // Force re-render when service is created
  const [isLoading, setIsLoading] = useState(false) // Loading state for prompt processing

  useEffect(() => {
    // Check if service ID is in URL
    const serviceId = searchParams.get('service')
    if (serviceId && !intentData) {
      // Load service from URL
      loadServiceFromId(serviceId)
    } else if (!intentData) {
      // Auto-show input after a brief delay for first load (only if no intent data)
      const timer = setTimeout(() => {
        setShowInput(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, intentData])

  const loadServiceFromId = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/services?id=${serviceId}`)
      const fullService = await response.json()
      
      // Create intent with service data
      const amount = fullService.amount || '0.1'
      const { depositAddress, intentId } = await generateDepositAddress(
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
          }
        }
      )
      
      setIntentData({
        type: 'payment',
        depositAddress,
        amount,
        redirectUrl: fullService.url,
        chain: fullService.chain,
        needsBridge: true,
        bridgeFrom: 'zcash',
        bridgeTo: fullService.chain,
        serviceName: fullService.name,
        receivingAddress: fullService.receivingAddress,
        currency: fullService.currency,
      })
      setShowFlow(true)
      
      // Start polling for deposit confirmation
      pollDepositConfirmation(depositAddress)
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

    try {
      // Parse intent using Next.js API route
      const parsed = await parseIntent(text)
      const amount = parsed.amount || ''
      const currency = parsed.metadata?.currency || ''
      const chain = parsed.chain || parsed.metadata?.chain || ''
      const receivingAddress = parsed.metadata?.receivingAddress || ''
      
      // Normalize currency to USDC if it's USDT or any USD variant
      const normalizedCurrency = (currency && (currency.toUpperCase() === 'USDT' || currency.toUpperCase().includes('USD'))) 
        ? 'USDC' 
        : currency
      
      // Check if payment data is complete (use normalized currency)
      const isComplete = isPaymentDataComplete(amount, normalizedCurrency, chain, receivingAddress)
      
      // Check if there's a currency conversion message
      const hasCurrencyConversion = parsed.aiMessage && parsed.aiMessage.includes('converted')
      
      if (isComplete && (!parsed.aiMessage || hasCurrencyConversion)) {
        // Full payment data available - generate QR code
        // If there was a currency conversion, we'll show it briefly but still generate QR
        const { depositAddress, intentId } = await generateDepositAddress(parsed.type, amount, parsed)
        
        setIntentData({
          type: parsed.type,
          depositAddress,
          amount,
          redirectUrl: parsed.redirect_url || '',
          chain: parsed.chain || parsed.metadata?.chain,
          needsBridge: parsed.needsBridge ?? parsed.metadata?.needsBridge,
          bridgeTo: parsed.bridgeTo || parsed.metadata?.bridgeTo,
          serviceName: parsed.metadata?.serviceName,
          receivingAddress: parsed.metadata?.receivingAddress,
          currency: normalizedCurrency || 'USDC',
          // Show currency conversion message if present, but still allow QR generation
          aiMessage: hasCurrencyConversion ? parsed.aiMessage : undefined,
        })
        setShowFlow(true)

        // Start polling for deposit confirmation
        pollDepositConfirmation(depositAddress)
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
          aiMessage: parsed.aiMessage || "I'd be happy to help you make a payment! To proceed, I need: the amount (e.g., 0.1 USDC), the target network (Base or Solana), and the payment address. Could you provide these details?",
        })
        setShowFlow(false) // Don't show flow for incomplete data
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
      setShowFlow(false)
    } finally {
      setIsLoading(false) // Hide loading state
    }
  }

  const generateDepositAddress = async (
    intentType: string, 
    amount: string,
    parsed: any
  ): Promise<{ depositAddress: string; intentId: string }> => {
    const timestamp = Date.now()
    const intentId = `intent-${timestamp}`
    
    // Generate Zcash deposit address
    // Zcash addresses start with 'z' (shielded) or 't' (transparent)
    // For demo, we'll generate a mock Zcash address
    const zcashAddress = generateZcashAddress(intentId)
    let depositAddress = zcashAddress
    
    // Register with relayer (now Next.js API with 1-Click integration)
    try {
      const response = await fetch('/api/relayer/register-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId,
          intentType,
          depositAddress, // Zcash address
          amount,
          recipient: parsed.metadata?.to || '',
          senderAddress: '', // Will be set from wallet if available
        }),
      })
      const data = await response.json()
      // Use real deposit address from 1-Click API if available (for swaps)
      if (data.depositAddress) {
        depositAddress = data.depositAddress
      }
    } catch (error) {
      console.error('Failed to register deposit:', error)
    }
    
    return { depositAddress, intentId }
  }

  const generateZcashAddress = (intentId: string): string => {
    // Generate a mock Zcash shielded address (Sapling format: starts with 'zs1')
    // In production, this would be generated by Zcash wallet or API
    // Zcash addresses: zs1 (Sapling shielded), zt1 (Orchard shielded), or t1/t3 (transparent)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const randomPart = Array.from({ length: 74 }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
    // Zcash Sapling shielded address format: zs1 + 75 characters
    return `zs1${randomPart}`
  }

  const pollDepositConfirmation = async (address: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch('/api/relayer/check-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        
        const data = await response.json()
        
        if (data.confirmed) {
          setDepositConfirmed(true)
          // Redirect to premium content after a brief delay
          setTimeout(() => {
            if (intentData?.redirectUrl) {
              window.location.href = intentData.redirectUrl
            }
          }, 2000)
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000) // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Polling error:', error)
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000)
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
    setShowFlow(false)
    setDepositConfirmed(false)
    setQuery('')
  }

  return (
      <main 
        className="relative min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-900"
        onClick={handleClickAnywhere}
      >
        <AmbientBackground />
        
        {/* Branding */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
          <h1 className="text-2xl font-bold gradient-text">Anyone Pay Legend</h1>
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
                  <span className="text-purple-400 text-lg">💬</span>
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
          {intentData && showFlow && intentData.depositAddress && !intentData.aiMessage && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <IntentsQR 
                depositAddress={intentData.depositAddress}
                amount={intentData.amount}
              />
            </motion.div>
          )}

          {/* Flow Diagram - third component */}
          {intentData && showFlow && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="w-full"
            >
              <IntentFlowDiagram 
                confirmed={depositConfirmed}
                chain={intentData.chain}
                needsBridge={intentData.needsBridge}
                bridgeTo={intentData.bridgeTo}
                serviceName={intentData.serviceName}
                receivingAddress={intentData.receivingAddress}
                amount={intentData.amount}
                currency={intentData.currency}
                depositAddress={intentData.depositAddress}
              />
            </motion.div>
          )}

          {/* Status message */}
          {depositConfirmed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-purple-400 text-sm flex items-center gap-2"
            >
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
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

