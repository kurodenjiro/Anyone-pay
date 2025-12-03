'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AmbientBackground } from '@/components/AmbientBackground'
import { FloatingInput } from '@/components/FloatingInput'
import { IntentsQR } from '@/components/IntentsQR'
import { CreateServiceModal } from '@/components/CreateServiceModal'
import { ServicesList } from '@/components/ServicesList'
import { parseIntent } from '@/lib/intentParser'

export default function Home() {
  return (
      <Suspense fallback={
        <main className="relative min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }>
        <HomeContent />
      </Suspense>
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
    deadline?: string // ISO 8601 format: "2025-11-30T19:12:39.942Z"
  } | null>(null)
  const [depositConfirmed, setDepositConfirmed] = useState(false)
  const [showCreateService, setShowCreateService] = useState(false)
  const [servicesKey, setServicesKey] = useState(0) // Force re-render when service is created
  const [isLoading, setIsLoading] = useState(false) // Loading state for prompt processing
  const [pollingStatus, setPollingStatus] = useState<string | null>(null) // Current polling status
  const [pollingAttempt, setPollingAttempt] = useState(0) // Current polling attempt number
  const [countdown, setCountdown] = useState<number | null>(null) // Countdown after deposit address creation
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null) // Time estimate from swap status
  const [swapStatus, setSwapStatus] = useState<string | null>(null) // Current swap status from oneClick API
  const [x402Status, setX402Status] = useState<string | null>(null) // x402 payment status
  const [redirectInfo, setRedirectInfo] = useState<{ url?: string; message?: string } | null>(null) // Redirect information
  const [showTxHashInput, setShowTxHashInput] = useState(false) // Show input for Zcash transaction hash
  const [txHash, setTxHash] = useState('') // User-entered transaction hash
  const [submittingTxHash, setSubmittingTxHash] = useState(false) // Loading state for submitting tx hash
  const [txHashSubmitResult, setTxHashSubmitResult] = useState<{ success: boolean; message: string } | null>(null) // Result of hash submission
  const [depositAddressLoaded, setDepositAddressLoaded] = useState(false) // Track if deposit address was loaded from URL

  useEffect(() => {
    // Check if deposit address is in URL
    const depositAddrFromUrl = searchParams.get('depositAddr')
    const serviceId = searchParams.get('service')
    const promptFromUrl = searchParams.get('prompt')
    
    // Check if we're in the middle of an active transaction
    // Don't reload if we're polling, submitting hash, or have active transaction state
    const hasActiveTransaction = pollingStatus !== null || 
                                  showTxHashInput || 
                                  submittingTxHash || 
                                  countdown !== null ||
                                  depositConfirmed
    
    // PRIORITY: If deposit address is in URL, load data from it (don't create new address)
    if (depositAddrFromUrl && !intentData && !hasActiveTransaction && !isLoading && !depositAddressLoaded) {
      // Load deposit data from URL parameter
      setDepositAddressLoaded(true) // Prevent multiple calls
      loadDepositFromAddress(depositAddrFromUrl)
    } else if (serviceId && !intentData && !hasActiveTransaction && !depositAddrFromUrl) {
      // Only load service if there's no depositAddr parameter
      loadServiceFromId(serviceId)
    } else if (promptFromUrl && !intentData && !query && !hasActiveTransaction && !depositAddrFromUrl) {
      // Only load prompt if there's no depositAddr parameter
      setQuery(promptFromUrl)
      setShowInput(true)
    } else if (!intentData && !promptFromUrl && !serviceId && !depositAddrFromUrl && !hasActiveTransaction) {
      // Auto-show input after a brief delay for first load (only if no intent data)
      const timer = setTimeout(() => {
        setShowInput(true)
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, intentData, query, pollingStatus, showTxHashInput, submittingTxHash, countdown, depositConfirmed, isLoading, depositAddressLoaded])
  
  // Handle prompt from URL after query is set
  useEffect(() => {
    const promptFromUrl = searchParams.get('prompt')
    const depositAddrFromUrl = searchParams.get('depositAddr')
    // Don't auto-submit if depositAddr is in URL (prioritize loading existing deposit)
    if (promptFromUrl && query === promptFromUrl && !intentData && !isLoading && !depositAddrFromUrl) {
      // Auto-submit the prompt from URL
      handleSubmit(promptFromUrl).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchParams])

  const loadDepositFromAddress = async (depositAddress: string) => {
    try {
      setIsLoading(true)
      console.log('🔄 Loading deposit from address:', depositAddress)
      
      // Check deposit status
      const response = await fetch('/api/relayer/check-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: depositAddress }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to check deposit status')
      }
      
      const data = await response.json()
      
      console.log('📦 Deposit status data:', {
        status: data.status,
        confirmed: data.confirmed,
        hasSwapStatus: !!data.swapStatus,
        hasIntentId: !!data.intentId,
        swapStatus: data.swapStatus
      })
      
      // Extract zcashAmount and deadline from swapStatus (always try to extract, even without tracking)
      let zcashAmount: string | undefined = undefined
      let deadline: string | undefined = undefined
      let quoteWaitingTimeMs: number | undefined = undefined
      
      if (data.swapStatus) {
        const swapStatus = data.swapStatus as any
        const quoteFromStatus = swapStatus?.quoteResponse?.quote
        
        // Extract zcashAmount
        if (quoteFromStatus?.amountInFormatted !== undefined && quoteFromStatus?.amountInFormatted !== null) {
          const rawValue = quoteFromStatus.amountInFormatted
          if (typeof rawValue === 'string') {
            zcashAmount = rawValue
          } else if (typeof rawValue === 'number') {
            zcashAmount = rawValue.toString()
          } else {
            zcashAmount = String(rawValue)
          }
        }
        
        // Extract deadline
        deadline = quoteFromStatus?.deadline || 
                   swapStatus?.quoteResponse?.quote?.deadline ||
                   null
        
        // Extract quoteWaitingTimeMs
        quoteWaitingTimeMs = quoteFromStatus?.quoteWaitingTimeMs || 
                            swapStatus?.quoteResponse?.quote?.quoteWaitingTimeMs ||
                            undefined
      }
      
      // Use amount from tracking if zcashAmount not available
      const displayAmount = zcashAmount || data.amount || '0'
      
      // Set intent data with the EXISTING deposit address (don't create new one)
      setIntentData({
        type: data.intentType || 'payment',
        depositAddress, // Use the existing deposit address from URL
        amount: displayAmount,
        redirectUrl: data.redirectUrl || '',
        chain: data.chain || 'base',
        needsBridge: true,
        bridgeFrom: 'zcash',
        bridgeTo: data.chain || 'base',
        currency: 'USDC',
        quoteWaitingTimeMs,
        deadline,
        serviceName: data.serviceName, // Include service name if available
      })
      
      console.log('✅ Loaded existing deposit address:', depositAddress)
      console.log('📊 Status:', data.status, 'Confirmed:', data.confirmed)
      
      // Always set polling status from the response
      if (data.status) {
        setPollingStatus(data.status)
        console.log('🔄 Set polling status to:', data.status)
      }
      
      // Extract and set swap status
      if (data.swapStatus) {
        const swapStatusData = data.swapStatus as any
        const currentSwapStatus = swapStatusData?.status || 
                                 swapStatusData?.executionStatus ||
                                 swapStatusData?.state ||
                                 data.status ||
                                 'PENDING_DEPOSIT'
        setSwapStatus(String(currentSwapStatus).toUpperCase())
      // Also check for x402 payment completion if signedPayload exists in database
      if (data.signedPayload) {
        console.log('✅ Found signedPayload in DB while loading intent data, x402 payment completed')
        setX402Status('x402 payment completed')
        setRedirectInfo({ 
          url: data.redirectUrl,
          message: 'Payment completed successfully'
        })
        setDepositConfirmed(true)
      }
      } else {
        setSwapStatus(data.status ? String(data.status).toUpperCase() : 'PENDING_DEPOSIT')
      }
      
      // If not confirmed, start polling
      if (!data.confirmed && data.status !== 'SUCCESS' && data.status !== 'REFUNDED' && data.status !== 'FAILED') {
        // Show input box for tx hash
        setShowTxHashInput(true)
        
        // Start polling to continue checking status
        console.log('🔄 Starting polling for deposit address:', depositAddress)
        pollDepositConfirmation(depositAddress)
      } else if (data.confirmed || data.status === 'SUCCESS') {
        // Already confirmed, set deposit confirmed
        console.log('✅ Deposit already confirmed')
        setDepositConfirmed(true)
      } else {
        // For other terminal states (REFUNDED, FAILED), just show the status
        console.log('⚠️ Deposit in terminal state:', data.status)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading deposit from address:', error)
      setIsLoading(false)
    }
  }

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
      
      const { depositAddress, intentId, quoteWaitingTimeMs, zcashAmount, deadline } = await generateDepositAddress(
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
      
      // Initialize swap status to PENDING_DEPOSIT when generating new deposit
      setSwapStatus('PENDING_DEPOSIT')
      
      // Update URL with deposit address parameter
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('depositAddr', depositAddress)
      window.history.pushState({}, '', newUrl.toString())
      
      // Log what we're setting
      console.log('📝 Setting intentData for service:')
      console.log('  - zcashAmount:', zcashAmount)
      console.log('  - amount (USDC):', amount)
      console.log('  - Final amount to display:', zcashAmount || amount)
      console.log('  - deadline:', deadline)
      
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
        deadline,
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
        }, 2000)
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
      const serviceId = parsed.metadata?.serviceId
      
      // Debug logging
      console.log('Parsed intent:', {
        amount,
        currency,
        chain,
        receivingAddress,
        serviceId,
        aiMessage: parsed.aiMessage,
        fullParsed: parsed
      })
      
      // If a service was matched, redirect to service page
      if (serviceId) {
        console.log('✅ Service matched, redirecting to service:', serviceId)
        router.push(`/?service=${serviceId}`, { scroll: false })
        return
      }
      
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
        const { depositAddress, intentId, quoteWaitingTimeMs, zcashAmount, deadline } = await generateDepositAddress(parsed.type, amount, parsed)
        
        // Initialize swap status to PENDING_DEPOSIT when generating new deposit
        setSwapStatus('PENDING_DEPOSIT')
        
        // Target API URL is now stored in database (depositTracking) via registerDeposit
        // No need to store in localStorage anymore
        const targetApiUrl = parsed.redirect_url || parsed.redirectUrl || ''
        
        // Update URL with deposit address parameter
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('depositAddr', depositAddress)
        window.history.pushState({}, '', newUrl.toString())
        
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
          deadline,
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
  ): Promise<{ depositAddress: string; intentId: string; quoteWaitingTimeMs?: number; zcashAmount?: string; deadline?: string }> => {
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
          metadata: parsed.metadata, // Include metadata (contains serviceName, etc.)
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
      
      // Log what we received from the API
      console.log('📥 Received from register-deposit API:')
      console.log('  - zcashAmount:', data.zcashAmount)
      console.log('  - amount (USDC):', amount)
      console.log('  - Full data:', data)
      
      return { 
        depositAddress: data.depositAddress, 
        intentId,
        quoteWaitingTimeMs: data.quoteWaitingTimeMs,
        zcashAmount: data.zcashAmount, // Amount of Zcash user needs to deposit (from amountInFormatted)
        deadline: data.deadline // ISO 8601 format deadline from quote response
      }
    } catch (error) {
      console.error('Failed to register deposit:', error)
      throw error
    }
  }

  const pollDepositConfirmation = async (address: string) => {
    // Calculate max attempts based on deadline (default 30 minutes if no deadline)
    // Poll every 5 seconds, so maxAttempts = deadlineSeconds / 5
    const defaultMaxAttempts = 360 // 30 minutes default (360 attempts * 5 seconds = 30 minutes)
    let maxAttempts = defaultMaxAttempts
    let attempts = 0
    let deadlineTimestamp: number | null = null

    console.log('🔄 Starting status polling...')
    setPollingStatus('PENDING')
    setPollingAttempt(0)
    
    // Show input box when polling starts (user can submit hash anytime)
    setShowTxHashInput(true)

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
        
        // Extract swapStatus from response
        const swapStatusResponse = data.swapStatus
        const currentSwapStatus = swapStatusResponse?.status || 
                          swapStatusResponse?.executionStatus ||
                          swapStatusResponse?.state ||
                          status
        
        const normalizedSwapStatus = String(currentSwapStatus).toUpperCase()
        
        // Update swap status state
        setSwapStatus(normalizedSwapStatus)
        
        // Update polling status in UI
        setPollingStatus(status)
        
        // Input box is already shown when polling starts
        // Polling continues regardless of whether user submits hash or not
        
        // Extract timeEstimate from swap status if available
        if (data.swapStatus?.quoteResponse?.quote?.timeEstimate) {
          const estimateSeconds = data.swapStatus.quoteResponse.quote.timeEstimate
          setTimeEstimate(estimateSeconds * 1000) // Convert to milliseconds
        }
        
        // Extract deadline from quote if available (first time only)
        if (!deadlineTimestamp && data.swapStatus?.quoteResponse?.quote?.deadline) {
          deadlineTimestamp = new Date(data.swapStatus.quoteResponse.quote.deadline).getTime()
          // Calculate max attempts based on deadline: (deadline - now) / 5 seconds per attempt
          const timeUntilDeadline = deadlineTimestamp - Date.now()
          if (timeUntilDeadline > 0) {
            maxAttempts = Math.ceil(timeUntilDeadline / 5000) // 5 seconds per attempt
            console.log(`📅 Using deadline-based polling: ${maxAttempts} attempts (${Math.ceil(timeUntilDeadline / 1000)}s until deadline)`)
          }
        }
        
        console.log(`   Current status: ${status}, Swap status: ${normalizedSwapStatus} (attempt ${attempts + 1}/${maxAttempts})`)
        
        // Stop polling if swap status is SUCCESS, REFUNDED, or INCOMPLETE_DEPOSIT
        if (normalizedSwapStatus === 'SUCCESS' || 
            normalizedSwapStatus === 'REFUNDED' || 
            normalizedSwapStatus === 'INCOMPLETE_DEPOSIT') {
          console.log(`🛑 Stopping deposit polling. Swap status: ${normalizedSwapStatus}`)
          setPollingStatus(normalizedSwapStatus)
          
          // If SUCCESS, start polling for x402 payment
          if (normalizedSwapStatus === 'SUCCESS') {
            console.log('✅ Swap successful! Starting x402 payment polling...')
            pollX402Payment(address)
          }
          
          return // Stop deposit polling
        }
        
        // Check if deadline has passed
        if (deadlineTimestamp && Date.now() > deadlineTimestamp) {
          console.log('⏰ Deadline passed, stopping polling')
          setPollingStatus('TIMEOUT')
          return // Stop polling
        }
        
        // If status is FAILED, stop polling
        if (status === 'FAILED' || normalizedSwapStatus === 'FAILED') {
          console.log(`❌ Swap failed with status: ${status}`)
          setPollingStatus(status)
          return // Stop polling
        }
        
        // Continue polling for PENDING_DEPOSIT, PROCESSING, INCOMPLETE_DEPOSIT, etc.
        // Polling continues regardless of whether user submits hash or not
        // Only stops when: SUCCESS, REFUNDED, FAILED, deadline passed, or max attempts reached
        
        // Continue polling if not at max attempts and deadline hasn't passed
        if (attempts < maxAttempts && (!deadlineTimestamp || Date.now() < deadlineTimestamp)) {
          attempts++
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          if (deadlineTimestamp && Date.now() >= deadlineTimestamp) {
            console.log('⏰ Deadline reached, stopping polling')
            setPollingStatus('TIMEOUT')
          } else {
            console.log('⏸️ Max polling attempts reached')
            setPollingStatus('TIMEOUT')
          }
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

  // Poll for x402 payment completion (check signedPayload in Supabase)
  const pollX402Payment = async (depositAddress: string) => {
    console.log('🔄 Starting x402 payment polling...')
    setX402Status('Waiting for x402 payment execution...')
    setRedirectInfo({ message: 'Payment is being processed. Please wait...' })
    
    let attempts = 0
    const maxAttempts = 360 // Poll for up to 5 minutes (60 attempts * 5 seconds)
    
    const poll = async () => {
      try {
        attempts++
        console.log(`   Checking x402 payment status (attempt ${attempts}/${maxAttempts})...`)
        
        const response = await fetch('/api/relayer/check-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: depositAddress }),
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log(data);
        // Check if signedPayload exists in database
        if (data.signedPayload) {
          console.log('✅ Found signedPayload in DB, x402 payment completed')
          setX402Status('x402 payment completed')
          setRedirectInfo({ 
            url: data.redirectUrl,
            message: 'Payment completed successfully' 
          })
          
          setDepositConfirmed(true)
          return // Stop polling
        }
        
        // Continue polling if signedPayload not found yet
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.log('⏸️ Max x402 polling attempts reached')
          setX402Status('Payment processing is taking longer than expected. Please check back later.')
        }
      } catch (error) {
        console.error('Error checking x402 payment status:', error)
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Retry after 5 seconds
        } else {
          console.log('⏸️ Max x402 polling attempts reached after error')
          setX402Status('Error checking payment status. Please try refreshing the page.')
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
  
  const handleSubmitTxHash = async () => {
    if (!txHash.trim() || !intentData?.depositAddress) {
      return
    }
    
    setSubmittingTxHash(true)
    setTxHashSubmitResult(null) // Clear previous result
    
    try {
      const response = await fetch('/api/relayer/submit-tx-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: txHash.trim(),
          depositAddress: intentData.depositAddress
        }),
      })
      
      const data = await response.json()
      
      // Check submitResult
      if (!response.ok) {
        setTxHashSubmitResult({
          success: false,
          message: data.error || data.details || 'Failed to submit transaction hash'
        })
        console.error('❌ Transaction hash submission failed:', data)
        return
      }
      
      // Success
      setTxHashSubmitResult({
        success: true,
        message: data.message || 'Transaction hash submitted successfully! This will speed up the swap process.'
      })
      console.log('✅ Transaction hash submitted:', data)
      
      // Clear input but keep input box visible (user might want to submit another hash)
      setTxHash('')
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setTxHashSubmitResult(null)
      }, 5000)
    } catch (error) {
      console.error('Error submitting transaction hash:', error)
      setTxHashSubmitResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit transaction hash'
      })
    } finally {
      setSubmittingTxHash(false)
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
    setShowTxHashInput(false)
    setTxHash('')
    setSubmittingTxHash(false)
    setTxHashSubmitResult(null)
    setDepositAddressLoaded(false) // Reset deposit address loaded flag
    setSwapStatus(null) // Reset swap status
    
    // Clear URL parameters and go to home
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('prompt')
    newUrl.searchParams.delete('service')
    newUrl.searchParams.delete('depositAddr') // Also clear deposit address parameter
    window.history.pushState({}, '', newUrl.pathname)
  }


  return (
      <main 
        className="relative min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-900"
        onClick={handleClickAnywhere}
      >
        <AmbientBackground />
        
        {/* Branding */}
        <div className="absolute top-10 md:top-12 left-1/2 transform -translate-x-1/2 z-0 text-center px-4 w-full max-w-4xl pointer-events-none">
          <button
            onClick={handleNewQuery}
            className="text-4xl md:text-6xl font-bold gradient-text hover:opacity-90 transition-opacity cursor-pointer block tracking-tight mx-auto pointer-events-auto"
          >
            Anyone Pay Legend
          </button>
          <p className="text-sm md:text-base text-gray-300 mt-5 md:mt-6 mb-8 md:mb-12 font-normal leading-relaxed max-w-2xl mx-auto">
            Private cross-chain x402 payments for merchants. Powered by Near AI, NEAR Intents & Chain Signatures
          </p>
        </div>
        
        {/* All components in one page flow - centered and shortened */}
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 max-w-2xl mx-auto w-full pt-48 md:pt-56 relative z-10">
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
              className="w-full bg-gradient-to-br from-purple-500/10 via-gray-800/40 to-blue-500/10 backdrop-blur-xl border-2 border-purple-500/30 rounded-3xl p-8 shadow-2xl shadow-purple-500/20"
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/20 flex items-center justify-center border border-purple-500/40">
                  <span className="text-purple-400 text-2xl">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-white text-base leading-relaxed">
                    {intentData.aiMessage}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* QR Code - only show when swap status is PENDING_DEPOSIT */}
          {intentData && intentData.depositAddress && !intentData.aiMessage && swapStatus === 'PENDING_DEPOSIT' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <div className="relative">
                <IntentsQR 
                  depositAddress={intentData.depositAddress}
                  amount={intentData.amount}
                  deadline={intentData.deadline}
                  quoteWaitingTimeMs={timeEstimate || intentData.quoteWaitingTimeMs}
                  status={pollingStatus}
                  pollingAttempt={pollingAttempt}
                  serviceName={intentData.serviceName}
                />
              </div>
            </motion.div>
          )}

          {/* Success message when deposit is detected (PROCESSING) */}
          {intentData && intentData.depositAddress && !intentData.aiMessage && swapStatus === 'PROCESSING' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-gradient-to-br from-green-500/20 via-green-500/10 to-blue-500/10 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-8 shadow-2xl shadow-green-500/20"
            >
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-green-600/20 flex items-center justify-center border-2 border-green-500/40">
                  <span className="text-green-400 text-3xl">✅</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-green-400 font-bold text-xl mb-2">Deposit Detected!</h3>
                  <p className="text-gray-200 text-base leading-relaxed">
                    Your deposit has been received and is being processed. The swap is in progress...
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Success message when swap is completed (SUCCESS) */}
          {intentData && intentData.depositAddress && !intentData.aiMessage && swapStatus === 'SUCCESS' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-gradient-to-br from-green-500/20 via-green-500/10 to-emerald-500/10 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-8 shadow-2xl shadow-green-500/20"
            >
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center border-2 border-green-500/40">
                  <span className="text-green-400 text-3xl">🎉</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-green-400 font-bold text-xl mb-2">Swap Successful!</h3>
                  <p className="text-gray-200 text-base leading-relaxed">
                    Your swap has been completed successfully. {x402Status ? `` : 'Waiting for x402 payment execution...'}
                  </p>
                </div>
              </div>
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

          {/* x402 Payment Status */}
          {x402Status && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gradient-to-br from-purple-500/20 via-gray-800/40 to-blue-500/10 backdrop-blur-xl border-2 border-purple-500/30 rounded-3xl p-6 shadow-2xl shadow-purple-500/20"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {x402Status === 'x402 payment completed' ? (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center border-2 border-green-500/40">
                      <span className="text-green-400 text-2xl">✅</span>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/20 flex items-center justify-center border-2 border-purple-500/40">
                      <div className="w-6 h-6 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-base text-white font-semibold mb-1">
                      {x402Status}
                    </p>
                    {redirectInfo?.message && (
                      <p className="text-sm text-gray-400">
                        {redirectInfo.message}
                      </p>
                    )}
                    {x402Status === 'x402 payment completed' && intentData?.depositAddress && (
                      <a
                        href={typeof window !== 'undefined' 
                          ? `${window.location.origin}/content?address=${intentData.depositAddress}`
                          : `/content?address=${intentData.depositAddress}`
                        }
                        className="text-sm text-purple-400 mt-2 font-mono break-all hover:text-purple-300 hover:underline transition-colors inline-block"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {typeof window !== 'undefined' 
                          ? `${window.location.origin}/content?address=${intentData.depositAddress}`
                          : `/content?address=${intentData.depositAddress}`
                        }
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Transaction Hash Input - Show when polling starts */}
          {showTxHashInput && intentData && pollingStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-gray-800/40 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-6 shadow-xl shadow-purple-500/20 mt-4"
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">
                    {pollingStatus === 'PROCESSING' ? '🎉 Deposit Detected!' : '💡 Speed Up Swap'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {pollingStatus === 'PROCESSING' 
                      ? 'Please enter your Zcash transaction hash to speed up the swap process.'
                      : 'Optionally enter your Zcash transaction hash to speed up the swap process (optional).'
                    }
                  </p>
                </div>
                
                {/* Show submit result if available */}
                {txHashSubmitResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg ${
                      txHashSubmitResult.success 
                        ? 'bg-green-500/20 border border-green-500/50' 
                        : 'bg-red-500/20 border border-red-500/50'
                    }`}
                  >
                    <p className={`text-sm ${
                      txHashSubmitResult.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {txHashSubmitResult.success ? '✅' : '❌'} {txHashSubmitResult.message}
                    </p>
                  </motion.div>
                )}
                
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => {
                      setTxHash(e.target.value)
                      // Clear result when user starts typing
                      if (txHashSubmitResult) {
                        setTxHashSubmitResult(null)
                      }
                    }}
                    placeholder="Enter Zcash transaction hash..."
                    className="flex-1 px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    disabled={submittingTxHash}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && txHash.trim() && !submittingTxHash) {
                        handleSubmitTxHash()
                      }
                    }}
                  />
                  <button
                    onClick={handleSubmitTxHash}
                    disabled={!txHash.trim() || submittingTxHash}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {submittingTxHash ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  You can find your transaction hash in your Zcash wallet or block explorer. This is optional - polling will continue automatically.
                </p>
                
                {/* Content URL */}
                {intentData?.depositAddress && (
                  <div className="pt-4 border-t border-gray-700/50">
                    <p className="text-xs text-gray-400 mb-2">Content URL:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-purple-400 break-all font-mono">
                        {typeof window !== 'undefined' 
                          ? `${window.location.origin}/content?address=${intentData.depositAddress}`
                          : `/content?address=${intentData.depositAddress}`
                        }
                      </code>
                      <button
                        onClick={(e) => {
                          const url = typeof window !== 'undefined' 
                            ? `${window.location.origin}/content?address=${intentData.depositAddress}`
                            : `/content?address=${intentData.depositAddress}`
                          navigator.clipboard.writeText(url)
                          // Show brief feedback
                          const btn = e.currentTarget as HTMLButtonElement
                          if (btn) {
                            const originalText = btn.textContent
                            btn.textContent = 'Copied!'
                            setTimeout(() => {
                              if (btn) btn.textContent = originalText
                            }, 2000)
                          }
                        }}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Status message */}
          {depositConfirmed && x402Status && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-green-400 text-sm flex items-center gap-2"
            >
              {x402Status === 'x402 payment completed' ? (
                <span className="text-green-400">✅</span>
              ) : (
                <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              )}
              {x402Status}
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
                <p className="text-sm mt-2">e.g., &quot;Pay ticket move Kiki deliver series&quot; or &quot;Swap 2 Zcash to USDC&quot;</p>
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
