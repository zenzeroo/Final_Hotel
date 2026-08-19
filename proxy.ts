import { updateSession } from '@/lib/supabase/proxy'
import type { NextRequest } from 'next/server'

/**
 * Proxy entry point (Next.js 16 — replaces middleware.ts).
 * Runs on every request matching the `config.matcher` pattern.
 */
export async function proxy(request: NextRequest) {
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
