'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'

interface IntentsQRProps {
  depositAddress: string
  amount: string
  deadline?: string // ISO 8601 format: "2025-11-30T19:12:39.942Z"
  quoteWaitingTimeMs?: number // Fallback if deadline not available
  status?: string | null // Current deposit status
  pollingAttempt?: number // Current polling attempt number
  serviceName?: string // Service name to display
}

export function IntentsQR({ depositAddress, amount, deadline, quoteWaitingTimeMs, status, pollingAttempt, serviceName }: IntentsQRProps) {
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Countdown timer calculated from deadline
  useEffect(() => {
    // Calculate countdown from deadline if available
    if (deadline) {
      const calculateCountdown = () => {
        const deadlineTime = new Date(deadline).getTime()
        const now = Date.now()
        const remaining = Math.max(0, Math.ceil((deadlineTime - now) / 1000))
        return remaining
      }

      // Initialize countdown
      const initialCountdown = calculateCountdown()
      setCountdown(initialCountdown)

      // Update countdown every second
      const interval = setInterval(() => {
        const remaining = calculateCountdown()
        setCountdown(remaining)
        
        if (remaining <= 0) {
          clearInterval(interval)
        }
      }, 1000)

      return () => clearInterval(interval)
    } 
    // Fallback to quoteWaitingTimeMs if deadline not available
    else if (quoteWaitingTimeMs) {
      // Initialize countdown with the waiting time in seconds
      const initialSeconds = Math.ceil(quoteWaitingTimeMs / 1000)
      setCountdown(initialSeconds)

      // Update countdown every second
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [deadline, quoteWaitingTimeMs])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(depositAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    } else if (minutes > 0) {
      return `${minutes}:${String(secs).padStart(2, '0')}`
    } else {
      return `${secs}s`
    }
  }

  // Get status display info
  const getStatusInfo = () => {
    if (!status) return null
    
    const normalizedStatus = String(status).toUpperCase()
    
    if (normalizedStatus === 'PENDING_DEPOSIT' || normalizedStatus === 'PENDING') {
      return {
        text: 'Waiting for deposit',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/50',
        icon: '⏳'
      }
    }
    if (normalizedStatus === 'PROCESSING') {
      return {
        text: 'Processing swap',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/50',
        icon: '🔄'
      }
    }
    if (normalizedStatus === 'SUCCESS') {
      return {
        text: 'Swap successful!',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/50',
        icon: '✅'
      }
    }
    if (normalizedStatus === 'REFUNDED') {
      return {
        text: 'Refunded',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        borderColor: 'border-orange-500/50',
        icon: '↩️'
      }
    }
    if (normalizedStatus === 'FAILED') {
      return {
        text: 'Swap failed',
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/50',
        icon: '❌'
      }
    }
    if (normalizedStatus === 'INCOMPLETE_DEPOSIT') {
      return {
        text: 'Incomplete deposit',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/50',
        icon: '⚠️'
      }
    }
    return {
      text: 'Checking status...',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/50',
      icon: '🔍'
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full shadow-xl shadow-purple-500/10">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Deposit Zcash
        </h2>
        {serviceName && (
          <p className="text-sm text-purple-300 font-medium mb-2">
            {serviceName}
          </p>
        )}
        <p className="text-sm text-gray-400">
          Deposit <span className="text-purple-400 font-medium">{amount} ZEC</span> to continue
        </p>
      </div>
      
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <QRCodeSVG
            value={depositAddress}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
        
        <div className="w-full space-y-2">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-2">Zcash Deposit Address</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={depositAddress}
              readOnly
              className="flex-1 px-3 py-2 text-xs font-mono bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              style={{ wordBreak: 'break-all' }}
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 rounded-lg transition-colors flex-shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Send ZEC to this shielded address
          </p>
          {(deadline || quoteWaitingTimeMs) && countdown !== null && countdown > 0 && (
            <div className="text-center mt-2">
              <p className="text-xs text-purple-400">
                Deposit: <span className="font-semibold">{formatTime(countdown)}</span> remaining
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge - at the bottom */}
      {statusInfo && (
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
            <span className="text-base">{statusInfo.icon}</span>
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
            {pollingAttempt !== undefined && pollingAttempt > 0 && (
              <span className={`text-xs ${statusInfo.color} opacity-70 ml-1`}>
                • {pollingAttempt}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

