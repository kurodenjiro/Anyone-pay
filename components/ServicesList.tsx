'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

interface PaymentService {
  id: string
  name: string
  keywords: string[]
  amount: string
  currency: string
  url?: string  // URL is hidden from list, only available when fetching by ID
  chain: string
  description?: string
  active: boolean
}

interface ServicesListProps {
  onServiceClick?: (service: PaymentService) => void
}

export function ServicesList({ onServiceClick }: ServicesListProps) {
  const [services, setServices] = useState<PaymentService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services')
      const data = await response.json()
      setServices(data.services || [])
    } catch (error) {
      console.error('Error loading services:', error)
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full flex justify-center py-4">
        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full text-center py-4 text-gray-500 text-sm"
      >
        No services available yet. Create one to get started!
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-2 max-h-96 overflow-y-auto"
    >
      {services.map((service, index) => (
        <motion.div
          key={service.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ 
            duration: 0.4,
            delay: index * 0.05,
            ease: [0.25, 0.46, 0.45, 0.94] // Smooth glide easing
          }}
          whileHover={{ 
            x: 4, // Glide to the right on hover
            borderColor: 'rgba(168, 85, 247, 0.5)',
            backgroundColor: 'rgba(31, 41, 55, 0.6)',
          }}
          className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-2 cursor-pointer transition-all duration-300 ease-out"
          onClick={() => onServiceClick?.(service)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium text-xs truncate mb-1">
                {service.name}
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-purple-300 font-medium">
                  {service.amount} {service.currency}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400 capitalize">
                  {service.chain}
                </span>
              </div>
            </div>
            <ExternalLink className="w-3 h-3 text-gray-500 flex-shrink-0" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}

