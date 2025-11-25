'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloatingInputProps {
  show: boolean
  onSubmit: (text: string) => void
  onClose: () => void
  loading?: boolean
  value?: string
  onChange?: (value: string) => void
}

export function FloatingInput({ show, onSubmit, onClose, loading = false, value: controlledValue, onChange }: FloatingInputProps) {
  const [internalValue, setInternalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Use controlled value if provided, otherwise use internal state
  const value = controlledValue !== undefined ? controlledValue : internalValue
  
  const handleValueChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue)
    } else {
      setInternalValue(newValue)
    }
  }

  useEffect(() => {
    if (show && inputRef.current && !loading) {
      inputRef.current.focus()
    }
  }, [show, loading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !loading) {
      onSubmit(value.trim())
      // Keep the value - don't clear it
      // Don't call onClose - keep input visible
    }
  }
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!loading) {
      handleValueChange(e.target.value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleValueChange('')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit} className="w-full relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to pay for today?"
              disabled={loading}
              className="w-full px-6 py-4 pr-12 text-lg bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-lg shadow-purple-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

