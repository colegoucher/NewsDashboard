// Best-effort in-memory rate limiter. In serverless each instance has its own
// map, so this isn't a hard global cap — but it adds real friction to a
// brute-force attempt against the single login endpoint, which is the point.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

// Opportunistic cleanup so the map can't grow unbounded.
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}
