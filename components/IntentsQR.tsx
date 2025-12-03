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
    <div className="bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 w-full shadow-2xl shadow-purple-500/20">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-4">
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          Deposit Zcash
        </h2>
        {serviceName && (
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
            <p className="text-sm text-purple-300 font-semibold">
              {serviceName}
            </p>
          </div>
        )}
        <p className="text-base text-gray-300">
          Deposit <span className="text-purple-400 font-bold text-lg">{amount} ZEC</span> to continue
        </p>
      </div>
      
      {/* QR Code Section */}
      <div className="flex flex-col items-center gap-6 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-2xl ring-4 ring-purple-500/10">
          <QRCodeSVG
            value={depositAddress}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>
        
        {/* Address Section */}
        <div className="w-full space-y-3">
          <div className="text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Zcash Deposit Address</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={depositAddress}
                readOnly
                className="w-full px-4 py-3 text-sm font-mono bg-gray-900/60 border-2 border-gray-700/50 rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                style={{ wordBreak: 'break-all' }}
              />
            </div>
            <button
              onClick={handleCopy}
              className={`px-4 py-3 rounded-xl transition-all flex-shrink-0 border-2 ${
                copied 
                  ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30' 
                  : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700 hover:border-purple-500/50'
              }`}
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-gray-300" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            Send ZEC to this shielded address
          </p>
          
          {/* Countdown */}
          {(deadline || quoteWaitingTimeMs) && countdown !== null && countdown > 0 && (
            <div className="text-center mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-sm text-gray-400 mb-1">Time Remaining</p>
              <p className="text-lg font-bold text-purple-400 font-mono">
                {formatTime(countdown)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge - Enhanced */}
      {statusInfo && (
        <div className="mt-8 pt-6 border-t border-gray-700/30">
          <div className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl ${statusInfo.bgColor} ${statusInfo.borderColor} border-2 backdrop-blur-sm`}>
            <span className="text-xl">{statusInfo.icon}</span>
            <span className={`text-sm font-semibold ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
            {pollingAttempt !== undefined && pollingAttempt > 0 && (
              <span className={`text-xs ${statusInfo.color} opacity-70 font-medium bg-black/20 px-2 py-1 rounded-full`}>
                {pollingAttempt}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

