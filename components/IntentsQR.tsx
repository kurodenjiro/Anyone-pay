'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'

interface IntentsQRProps {
  depositAddress: string
  amount: string
  quoteWaitingTimeMs?: number
}

export function IntentsQR({ depositAddress, amount, quoteWaitingTimeMs }: IntentsQRProps) {
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Countdown timer for quote processing time
  useEffect(() => {
    if (!quoteWaitingTimeMs) return

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
  }, [quoteWaitingTimeMs])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(depositAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full shadow-xl shadow-purple-500/10">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Deposit Zcash
        </h2>
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
          {quoteWaitingTimeMs && countdown !== null && countdown > 0 && (
            <div className="text-center mt-2">
              <p className="text-xs text-purple-400">
                Deposit: <span className="font-semibold">{countdown}s</span> remaining
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

