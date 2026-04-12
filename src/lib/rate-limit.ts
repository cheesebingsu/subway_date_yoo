// In-memory rate limiting mechanism (Temporary replacement for Upstash)
// Works only as long as the server process is alive.

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitInfo>();

/**
 * Basic Token Bucket Rate Limiter
 * @param identifier Unique identifier (e.g., ip address or user_id)
 * @param maxRequests Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds
 * @returns boolean true if allowed, false if rate limited
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const info = rateLimitStore.get(identifier);

  if (!info || now > info.resetTime) {
    // New or expired token
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (info.count >= maxRequests) {
    return false; // Rate limited
  }

  // Allowed
  info.count += 1;
  return true;
}
