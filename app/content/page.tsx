'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'

function ContentPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 dark:bg-black/30 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/20 max-w-2xl w-full"
      >
        <h1 className="text-3xl font-bold text-white mb-6">Premium Content Unlocked</h1>
        <p className="text-white/70 mb-8">
          Your intent has been executed successfully. Access granted with token:
        </p>
        
        <div className="bg-white/10 rounded-lg p-4 mb-6">
          <p className="text-xs font-mono text-white break-all">{token}</p>
        </div>
        
        <p className="text-white/50 text-sm mb-8">
          This is your premium content. In production, this would display the actual
          weather forecast, generated image, or other premium data.
        </p>
        
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
        >
          Start New Intent
        </button>
      </motion.div>
    </div>
  )
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <ContentPageContent />
    </Suspense>
  )
}

