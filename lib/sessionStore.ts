/**
 * Session store for managing deposit addresses and swap data
 * Uses in-memory store (in production, use Redis or database)
 */

interface SessionData {
  depositAddress: string
  sessionId: string
  quoteData?: any
  swapWalletAddress?: string
  nearAccountId?: string
  createdAt: number
}

// In-memory store (in production, use Redis or database)
const sessionStore = new Map<string, SessionData>()

/**
 * Store session data with deposit address
 */
export function storeSessionData(sessionId: string, data: Omit<SessionData, 'createdAt'>) {
  sessionStore.set(sessionId, {
    ...data,
    createdAt: Date.now(),
  })
  return sessionStore.get(sessionId)
}

/**
 * Get session data by sessionId
 */
export function getSessionData(sessionId: string): SessionData | undefined {
  return sessionStore.get(sessionId)
}

/**
 * Delete session data
 */
export function deleteSessionData(sessionId: string) {
  sessionStore.delete(sessionId)
}

/**
 * Check if session exists
 */
export function hasSession(sessionId: string): boolean {
  return sessionStore.has(sessionId)
}

/**
 * Get all sessions (for debugging)
 */
export function getAllSessions(): Array<[string, SessionData]> {
  return Array.from(sessionStore.entries())
}

