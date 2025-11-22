// Deposit tracking store (in production, use a database like Redis or PostgreSQL)

interface DepositTracking {
  intentId: string
  amount: string
  recipient?: string
  createdAt: number
  confirmed: boolean
  confirmedAt?: number
  swapId?: string
  intentType?: string
}

// In-memory store (for demo - use a database in production)
const depositTracking = new Map<string, DepositTracking>()

export function registerDeposit(
  depositAddress: string,
  intentId: string,
  amount: string,
  recipient?: string,
  swapId?: string,
  intentType?: string
) {
  depositTracking.set(depositAddress, {
    intentId,
    amount,
    recipient,
    createdAt: Date.now(),
    confirmed: false,
    swapId,
    intentType,
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

