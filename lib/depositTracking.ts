// Deposit tracking store (in production, use a database like Redis or PostgreSQL)

interface DepositTracking {
  intentId: string
  amount: string
  recipient?: string // Original payment address from AI (for x402)
  swapWalletAddress?: string // Newly created wallet address (receives swap, signs x402)
  swapWalletPrivateKey?: string // Private key for signing x402
  createdAt: number
  confirmed: boolean
  confirmedAt?: number
  swapId?: string
  intentType?: string
  chain?: string // Target chain for x402 payment
  x402Executed?: boolean // Whether x402 payment has been executed
  redirectUrl?: string // Original redirect URL for content
}

// In-memory store (for demo - use a database in production)
const depositTracking = new Map<string, DepositTracking>()

export function registerDeposit(
  depositAddress: string,
  intentId: string,
  amount: string,
  recipient?: string, // Original payment address from AI
  swapId?: string,
  intentType?: string,
  swapWalletAddress?: string, // New wallet for receiving swap
  swapWalletPrivateKey?: string, // Private key for signing x402
  chain?: string, // Target chain
  redirectUrl?: string // Original redirect URL for content
) {
  depositTracking.set(depositAddress, {
    intentId,
    amount,
    recipient, // Original x402 payment address
    swapWalletAddress, // New wallet that receives swap
    swapWalletPrivateKey, // For signing x402
    createdAt: Date.now(),
    confirmed: false,
    swapId,
    intentType,
    chain,
    x402Executed: false,
    redirectUrl, // Store redirect URL
  })
  return { success: true, depositAddress }
}

export function getDepositTracking(depositAddress: string): DepositTracking | undefined {
  return depositTracking.get(depositAddress)
}

export function markDepositConfirmed(depositAddress: string) {
  const tracking = depositTracking.get(depositAddress)
  if (tracking) {
    tracking.confirmed = true
    tracking.confirmedAt = Date.now()
    depositTracking.set(depositAddress, tracking)
  }
  return tracking
}

export function getAllPendingDeposits(): Array<[string, DepositTracking]> {
  return Array.from(depositTracking.entries()).filter(
    ([_, tracking]) => !tracking.confirmed
  )
}

