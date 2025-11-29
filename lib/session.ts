/**
 * Session management utilities
 * Creates unique session IDs for tracking swap requests
 */

/**
 * Create a new session ID
 * @param intentId Optional intent ID to include in session ID
 * @param serviceId Optional service ID to use instead of intentId (takes priority)
 * @returns Unique session ID (replaces hyphens with underscores)
 */
export function createSessionId(intentId?: string, serviceId?: string): string {
  // Service ID takes priority over intentId
  const id = serviceId || intentId
  if (id) {
    // Replace hyphens with underscores
    const sanitizedId = id.replace(/-/g, '_')
    return `session_${sanitizedId}`
  }
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

