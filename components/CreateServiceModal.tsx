'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface CreateServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onServiceCreated?: () => void
}

export function CreateServiceModal({ isOpen, onClose, onServiceCreated }: CreateServiceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    keywords: '',
    amount: '',
    currency: 'USDC',
    url: '', // Direct URL to content/service
    chain: 'base',
    receivingAddress: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const keywords = formData.keywords.split(',').map(k => k.trim()).filter(k => k)

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          keywords,
          amount: formData.amount,
          currency: formData.currency,
          url: formData.url,
          chain: formData.chain,
          receivingAddress: formData.receivingAddress,
          description: formData.description,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create service')
      }

      const service = await response.json()
      console.log('Service created:', service)
      
      // Reset form
      setFormData({
        name: '',
        keywords: '',
        amount: '',
        currency: 'USDC',
        url: '',
        chain: 'base',
        receivingAddress: '',
        description: '',
      })

      onServiceCreated?.()
      onClose()
    } catch (error) {
      console.error('Error creating service:', error)
      alert(error instanceof Error ? error.message : 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create Payment Service</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Kiki Deliver Series Ticket"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Keywords (comma-separated) *
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="kiki, deliver, series, ticket, move"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Users can search for this service using these keywords
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Payment Amount *
                    </label>
                    <input
                      type="text"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0.1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Currency *
                    </label>
                    <input
                      type="text"
                      value="USDC"
                      disabled
                      className="w-full px-4 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Only USDC payments are supported
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Content URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="https://example.com/content"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Direct URL to the content or service that will be unlocked after payment
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Target Blockchain *
                  </label>
                  <select
                    value={formData.chain}
                    onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="base">Base</option>
                    <option value="solana">Solana</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Only Base and Solana are supported
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Receiving Address *
                  </label>
                  <input
                    type="text"
                    value={formData.receivingAddress}
                    onChange={(e) => setFormData({ ...formData, receivingAddress: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={
                      formData.chain === 'base' 
                        ? '0x...' 
                        : 'Solana wallet address...'
                    }
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.chain === 'base' 
                      ? 'Base network wallet address (0x...)'
                      : 'Solana wallet address'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Brief description of the service"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {loading ? 'Creating...' : 'Create Service'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

