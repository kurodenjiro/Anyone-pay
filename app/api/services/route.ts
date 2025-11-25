// API routes for managing payment services
import { NextRequest, NextResponse } from 'next/server'
import {
  getAllServices,
  getServiceById,
  addService,
  updateService,
  deleteService,
  searchServicesSemantic,
  PaymentService,
} from '@/lib/serviceRegistry'

// GET /api/services - Get all services or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const id = searchParams.get('id')

    if (id) {
      // Get specific service by ID (URL included for payment flow)
      const service = await getServiceById(id)
      if (!service) {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        )
      }
      // Include URL only when fetching by ID (for payment flow)
      return NextResponse.json(service)
    }

    if (query) {
      // Search services using semantic search
      // Only returns services that match above threshold
      const results = await searchServicesSemantic(query, 0.7)
      // Remove URL from response for security
      const resultsWithoutUrl = results.map(({ url, ...service }) => service)
      return NextResponse.json({ services: resultsWithoutUrl, query })
    }

    // Get all services (hide URL from public API)
    const services = await getAllServices()
    // Remove URL from response for security
    const servicesWithoutUrl = services.map(({ url, ...service }) => service)
    return NextResponse.json({ services: servicesWithoutUrl })
  } catch (error) {
    console.error('Error getting services:', error)
    return NextResponse.json(
      { error: 'Failed to get services', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/services - Create a new service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, keywords, amount, currency, url, chain, receivingAddress, description } = body

    if (!name || !keywords || !amount || !url || !chain) {
      return NextResponse.json(
        { error: 'Missing required fields: name, keywords, amount, url, chain' },
        { status: 400 }
      )
    }

    // Validate currency is USDC
    if (currency !== 'USDC') {
      return NextResponse.json(
        { error: 'Only USDC currency is supported' },
        { status: 400 }
      )
    }

    // Validate chain is Base or Solana
    if (chain !== 'base' && chain !== 'solana') {
      return NextResponse.json(
        { error: 'Only Base and Solana chains are supported' },
        { status: 400 }
      )
    }

    // Validate receiving address is required
    if (!receivingAddress) {
      return NextResponse.json(
        { error: 'Receiving address is required' },
        { status: 400 }
      )
    }

    const service = await addService({
      name,
      keywords: Array.isArray(keywords) ? keywords : [keywords],
      amount,
      currency: currency || 'USDC',
      url,
      chain,
      receivingAddress,
      description,
      active: true,
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Failed to create service', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PUT /api/services/[id] - Update a service
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing service ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const updated = await updateService(id, body)

    if (!updated) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: 'Failed to update service', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/services/[id] - Delete/deactivate a service
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing service ID' },
        { status: 400 }
      )
    }

    const deleted = await deleteService(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Service deactivated' })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: 'Failed to delete service', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

