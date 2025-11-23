// Test file to verify Supabase integration
// Run with: npx tsx lib/serviceRegistry.test.ts

import { 
  addService, 
  getAllServices, 
  findBestService, 
  searchServicesSemantic 
} from './serviceRegistry'

async function testSupabaseIntegration() {
  console.log('🧪 Testing Supabase Integration...\n')

  // Test 1: Get all services
  console.log('1️⃣ Testing getAllServices()...')
  try {
    const services = await getAllServices()
    console.log(`✅ Found ${services.length} services`)
    if (services.length > 0) {
      console.log(`   Example: ${services[0].name}`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }

  // Test 2: Semantic search
  console.log('\n2️⃣ Testing semantic search...')
  try {
    const query = 'Pay ticket move Kiki deliver series'
    const results = await searchServicesSemantic(query, 0.7)
    console.log(`✅ Found ${results.length} matches for: "${query}"`)
    results.forEach((service, i) => {
      console.log(`   ${i + 1}. ${service.name} (${service.amount} ${service.currency})`)
    })
  } catch (error) {
    console.error('❌ Error:', error)
  }

  // Test 3: Find best service
  console.log('\n3️⃣ Testing findBestService()...')
  try {
    const query = 'Kiki deliver series ticket'
    const best = await findBestService(query, 0.7)
    if (best) {
      console.log(`✅ Best match: ${best.name}`)
      console.log(`   Amount: ${best.amount} ${best.currency}`)
      console.log(`   URL: ${best.url}`)
      console.log(`   Chain: ${best.chain}`)
    } else {
      console.log(`⚠️  No match found for: "${query}"`)
      console.log('   (This is expected if similarity is below threshold)')
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }

  // Test 4: Create a test service
  console.log('\n4️⃣ Testing addService()...')
  try {
    const testService = await addService({
      name: 'Test Service',
      keywords: ['test', 'example', 'demo'],
      amount: '0.5',
      currency: 'USD',
      url: 'https://example.com/test',
      chain: 'ethereum',
      description: 'This is a test service',
      active: true,
    })
    console.log(`✅ Created service: ${testService.id}`)
    console.log(`   Name: ${testService.name}`)
  } catch (error) {
    console.error('❌ Error:', error)
    if (error instanceof Error && error.message.includes('Supabase not configured')) {
      console.log('   💡 Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
    }
  }

  console.log('\n✅ Tests completed!')
}

// Run tests if executed directly
if (require.main === module) {
  testSupabaseIntegration().catch(console.error)
}

export { testSupabaseIntegration }

