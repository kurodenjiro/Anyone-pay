'use client'

// Public page for managing payment services
// Anyone can create, view, and manage payment services

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

interface PaymentService {
  id: string
  name: string
  keywords: string[]
  amount: string
  currency: string
  url: string
  chain: string
  description?: string
  active: boolean
}

export default function ServicesAdminPage() {
  const [services, setServices] = useState<PaymentService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState<PaymentService | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    keywords: '',
    amount: '',
    currency: 'USD',
    url: '',
    chain: 'ethereum',
    description: '',
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const keywords = formData.keywords.split(',').map(k => k.trim()).filter(k => k)
    
    try {
      if (editingService) {
        // Update existing service
        const response = await fetch(`/api/services?id=${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            keywords,
          }),
        })
        if (!response.ok) throw new Error('Failed to update service')
      } else {
        // Create new service
        const response = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            keywords,
          }),
        })
        if (!response.ok) throw new Error('Failed to create service')
      }
      
      await loadServices()
      resetForm()
    } catch (error) {
      console.error('Error saving service:', error)
      alert('Failed to save service')
    }
  }

  const handleEdit = (service: PaymentService) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      keywords: service.keywords.join(', '),
      amount: service.amount,
      currency: service.currency,
      url: service.url,
      chain: service.chain,
      description: service.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    
    try {
      const response = await fetch(`/api/services?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete service')
      await loadServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('Failed to delete service')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      keywords: '',
      amount: '',
      currency: 'USD',
      url: '',
      chain: 'ethereum',
      description: '',
    })
    setEditingService(null)
    setShowForm(false)
  }

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return <div className="p-8">Loading services...</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Payment Services</h1>
            <p className="text-gray-400 mt-2">Create and manage payment services. Anyone can create services.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Create Service'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 mb-8 space-y-4">
            <h2 className="text-xl font-semibold mb-4">
              {editingService ? 'Edit Service' : 'Create New Service'}
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  placeholder="kiki, deliver, series, ticket"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="text"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  placeholder="0.1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                >
                  <option value="USD">USD</option>
                  <option value="NEAR">NEAR</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Redirect URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  placeholder="https://example.com/access"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Blockchain</label>
                <select
                  value={formData.chain}
                  onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="near">NEAR</option>
                  <option value="solana">Solana</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                {editingService ? 'Update' : 'Create'} Service
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredServices.map((service) => (
            <div key={service.id} className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{service.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Amount:</span>{' '}
                      <span className="font-medium">{service.amount} {service.currency}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Chain:</span>{' '}
                      <span className="font-medium">{service.chain}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">URL:</span>{' '}
                      <span className="font-mono text-xs">{service.url}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Keywords:</span>{' '}
                      <span className="text-purple-400">{service.keywords.join(', ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? 'No services found matching your search' : 'No services yet. Create one to get started!'}
          </div>
        )}
      </div>
    </div>
  )
}

