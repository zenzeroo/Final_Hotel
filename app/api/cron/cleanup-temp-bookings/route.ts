import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Phase 42 — Daily cron: cleanup_abandoned_temp_bookings.
 *
 * Vercel Hobby plan = 1 cron/day max (schedule "0 0 * * *" — UTC midnight).
 * This is HYGIENE ONLY — the PRIMARY expiry mechanism is lazy: when a user
 * reads their bookings, `expire_user_temp_bookings` / `expire_specific_temp_booking`
 * RPCs flip stale rows to 'expired' on the spot. The cron catches rows whose
 * owner never returned to read them after the hold expired.
 *
 * Auth:
 *   - Vercel sends `x-vercel-cron: 1` header automatically.
 *   - We ALSO require `Authorization: Bearer <CRON_SECRET>` if env var is set
 *     (defense-in-depth — manual curl from outside Vercel won't pass without it).
 *
 * Returns:
 *   - 200 with `{ ok: true, expired: N, ranAt: ISO }` on success
 *   - 401 if auth check fails
 *   - 500 if RPC errors
 */
export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron')
  const authHeader = request.headers.get('authorization')

  // Defense-in-depth: require Vercel's cron header AND CRON_SECRET if set.
  const expectedAuth = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null

  if (!cronHeader) {
    return NextResponse.json({ error: 'Unauthorized (missing x-vercel-cron)' }, { status: 401 })
  }
  if (expectedAuth && authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized (bad CRON_SECRET)' }, { status: 401 })
  }

  try {
    const admin = await createAdminClient()
    const { data, error } = await admin.rpc('cleanup_abandoned_temp_bookings')

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      expired: data ?? 0,
      ranAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
