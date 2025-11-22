'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

function ReceiptContent() {
  const searchParams = useSearchParams()
  const item = searchParams.get('item') || 'item'
  const token = searchParams.get('token') || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900/20 via-blue-900/20 to-purple-900/20 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 dark:bg-black/30 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/20 max-w-md w-full"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-6" />
          </motion.div>
          
          <h1 className="text-3xl font-bold text-white mb-4">Purchase Complete!</h1>
          <p className="text-white/70 mb-8">Your {item.replace('-', ' ')} has been purchased.</p>
          
          <div className="bg-white/10 rounded-lg p-4 mb-6">
            <p className="text-sm text-white/50 mb-2">Access Token</p>
            <p className="text-xs font-mono text-white break-all">{token}</p>
          </div>
          
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <ReceiptContent />
    </Suspense>
  )
}

