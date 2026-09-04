import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * Proxy entry point (Next.js 16 — replaces middleware.ts).
 * Runs on every request matching the `config.matcher` pattern.
 *
 * Phase 20 #29 — applies app-level rate limiting on sensitive paths
 * (login, register, OAuth callback, payments checkout) BEFORE the auth
 * refresh runs. Defense-in-depth on top of Supabase's built-in auth
 * throttle. See `lib/rate-limit.ts` for the token bucket implementation.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  // Rate-limit check on sensitive mutation paths (POST/PUT/DELETE).
  // GET requests aren't throttled at the proxy — they're cheap and
  // already constrained by the SSR render budget.
  const isMutation = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'
  if (isMutation) {
    const limit = checkRateLimit(getClientIp(request), pathname)
    if (!limit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง',
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(limit.retryAfterSeconds),
            'X-RateLimit-Limit': String(limit.limit),
          },
        }
      )
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - image files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
}
