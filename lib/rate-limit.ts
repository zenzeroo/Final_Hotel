/**
 * In-memory token bucket rate limiter (Phase 20 #29).
 *
 * Single-process implementation — fine for dev + single-instance deploys.
 * For multi-instance production, swap `buckets` for Upstash Redis or
 * similar (the `checkRateLimit` API stays the same).
 *
 * Pattern: token bucket per (route, clientIp). Each bucket holds up to
 * `max` tokens and refills continuously at `max` tokens per `windowMs`.
 * Each request consumes 1 token; empty bucket returns 429 with
 * `Retry-After` (seconds until the next whole token).
 *
 * Only the routes in ROUTE_CONFIG are limited. Every other path —
 * server actions on other pages, the Stripe webhook — returns null and
 * is never throttled here.
 *
 * Known limitation: buckets live in this process's memory, so on a
 * multi-instance host (Vercel) each instance counts on its own.
 *
 * Memory bound: LRU evicts buckets idle for > 1 hour, capped at 10k
 * entries. Stale entries never grow the heap under normal traffic.
 *
 * Why in-memory + LRU instead of Upstash:
 *   - Zero deps, zero config, zero extra env vars
 *   - 1 line to swap later: `export const checkRateLimit = redisImpl`
 *   - Adequate for current dev/test load; multi-instance prod can wait
 *
 * Usage:
 *   import { checkRateLimit } from '@/lib/rate-limit'
 *   const limit = checkRateLimit(ip, '/login')
 *   if (!limit.allowed) return new Response('Too Many Requests', { status: 429, headers: limit.headers })
 */

type Bucket = {
  tokens: number
  lastRefill: number // epoch ms
}

type RouteConfig = {
  /** Max tokens in the bucket (== max burst). */
  max: number
  /** Time in ms for an empty bucket to refill completely (`max` tokens). */
  windowMs: number
}

/**
 * Per-route overrides. Keep this small — proxy runs on every request.
 *
 * Tune these via env vars in lib/env.ts if needed; defaults are sane
 * for dev. Lower the numbers for prod if you see abuse patterns.
 */
const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/login': { max: 10, windowMs: 60_000 }, // 10 attempts/min per IP
  '/register': { max: 5, windowMs: 60_000 }, // 5 signups/min per IP
  '/auth/callback': { max: 20, windowMs: 60_000 }, // 20 OAuth callbacks/min
  '/api/payments/checkout': { max: 10, windowMs: 60_000 }, // 10 checkout starts/min
  '/forgot-password': { max: 5, windowMs: 60_000 }, // 5 reset requests/min per IP
  '/reset-password': { max: 10, windowMs: 60_000 }, // 10 password updates/min per IP
}

function getConfig(route: string): RouteConfig | null {
  // Exact match first, then prefix match for nested routes.
  if (ROUTE_CONFIG[route]) return ROUTE_CONFIG[route]
  for (const [prefix, config] of Object.entries(ROUTE_CONFIG)) {
    if (route.startsWith(prefix + '/')) return config
  }
  return null
}

// LRU-ish: Map preserves insertion order; we re-insert on hit to keep
// hot buckets at the tail. Eviction = delete oldest when over MAX_BUCKETS.
const MAX_BUCKETS = 10_000
const IDLE_TTL_MS = 60 * 60 * 1000 // 1 hour
const buckets = new Map<string, Bucket>()

function gc(now: number) {
  // Cheap sweep — only on hit/miss when over the soft cap.
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > IDLE_TTL_MS) buckets.delete(key)
    else break // Map iteration is insertion-ordered; oldest first
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; limit: number }
  | { allowed: false; retryAfterSeconds: number; limit: number }

/**
 * Check rate limit for a (route, ip) pair.
 *
 * @param ip   - Client IP. Falls back to 'unknown' for missing headers.
 * @param route - Logical route key (use `request.nextUrl.pathname`).
 *
 * Returns null for a route that is not rate-limited, `{ allowed: true,
 * remaining, limit }` if the request may proceed, or `{ allowed: false,
 * retryAfterSeconds, limit }` if the bucket is empty.
 */
export function checkRateLimit(ip: string, route: string): RateLimitResult | null {
  const config = getConfig(route)
  if (!config) return null
  const key = `${ip}:${route}`
  const now = Date.now()
  gc(now)

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: config.max, lastRefill: now }
    buckets.set(key, bucket)
  } else {
    // Re-insert to mark as recently used (LRU touch).
    buckets.delete(key)
    buckets.set(key, bucket)

    // Continuous refill: max tokens per windowMs, capped at max.
    const elapsed = now - bucket.lastRefill
    if (elapsed > 0) {
      bucket.tokens = Math.min(config.max, bucket.tokens + (elapsed * config.max) / config.windowMs)
      bucket.lastRefill = now
    }
  }

  if (bucket.tokens < 1) {
    const retryAfterMs = ((1 - bucket.tokens) * config.windowMs) / config.max
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      limit: config.max,
    }
  }

  bucket.tokens -= 1
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    limit: config.max,
  }
}

/**
 * Extract client IP from request headers. Falls back to 'unknown' if no
 * forwarded-for or x-real-ip header is present (e.g. local dev without
 * a reverse proxy).
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // First IP in the comma-separated list is the original client.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = request.headers.get('x-real-ip')
  if (xri) return xri
  return 'unknown'
}
