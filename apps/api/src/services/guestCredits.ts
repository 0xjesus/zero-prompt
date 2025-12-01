/**
 * Guest Credits Tracking Service
 *
 * Manages guest user credit balances in-memory.
 * In production, this should be moved to Redis or database for persistence.
 */

// Free credits for guest users (in USD)
export const FREE_GUEST_CREDITS = 0.50;

// In-memory cache for guest usage tracking
// Key: guestId, Value: total USD spent
const guestUsageCache = new Map<string, number>();

/**
 * Get remaining credits for a guest user
 */
export function getGuestCredits(guestId: string | null): number {
  if (!guestId) return FREE_GUEST_CREDITS;
  const currentUsage = guestUsageCache.get(guestId) || 0;
  return Math.max(0, FREE_GUEST_CREDITS - currentUsage);
}

/**
 * Get total usage for a guest user
 */
export function getGuestUsage(guestId: string | null): number {
  if (!guestId) return 0;
  return guestUsageCache.get(guestId) || 0;
}

/**
 * Record usage for a guest user
 */
export function recordGuestUsage(guestId: string | null, amountUSD: number): void {
  if (!guestId) return;
  const currentUsage = guestUsageCache.get(guestId) || 0;
  guestUsageCache.set(guestId, currentUsage + amountUSD);
  console.log(`[GuestCredits] ${guestId}: +$${amountUSD.toFixed(6)} (Total: $${(currentUsage + amountUSD).toFixed(6)}/${FREE_GUEST_CREDITS})`);
}

/**
 * Check if guest has enough credits
 */
export function hasGuestCredits(guestId: string | null, requiredAmount: number): boolean {
  return getGuestCredits(guestId) >= requiredAmount;
}

/**
 * Reset guest credits (for testing or admin use)
 */
export function resetGuestCredits(guestId: string): void {
  guestUsageCache.delete(guestId);
}

/**
 * Get all guest usage data (for admin/debugging)
 */
export function getAllGuestUsage(): Map<string, number> {
  return new Map(guestUsageCache);
}
