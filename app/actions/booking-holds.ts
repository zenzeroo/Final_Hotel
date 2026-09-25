'use server'

/**
 * Phase 40 — server actions for booking holds.
 *
 * The `/bookings/new` page mount calls `acquireBookingHoldAction` to
 * reserve a 10-minute hold on the room_type+dates. The hold id is
 * stored in the `bh_id` cookie so:
 *   1. Refreshes of /bookings/new within the TTL window hit the same
 *      row (ON CONFLICT DO UPDATE refreshes expires_at) — no error.
 *   2. After a successful booking the cookie becomes stale — the
 *      create_booking RPC atomically DELETEs the hold, and the next
 *      mount acquires a fresh one if needed.
 *
 * Best-effort release is intentionally NOT triggered by pagehide/visibility
 * events — the 10-minute TTL is the real safety net. Per Phase 40 spec,
 * "sendBeacon is nice-to-have, not a correctness requirement".
 */

import { z } from 'zod'
import { cookies } from 'next/headers'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { acquireHold, releaseHold } from '@/lib/data/booking-holds'

const HOLD_COOKIE = 'bh_id'
const HOLD_TTL_MINUTES = 10

const acquireSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type AcquireBookingHoldResult =
  | { ok: true; holdId: string; expiresAt: string }
  | { ok: false; error: string }

/**
 * Acquire a 10-minute hold on the room_type+dates for the current user.
 * Returns the hold's id + expiry. Caller (the /bookings/new server
 * component) sets the cookie + redirects on `{ ok: false }`.
 */
export async function acquireBookingHoldAction(input: {
  roomTypeId: string
  checkIn: string
  checkOut: string
}): Promise<AcquireBookingHoldResult> {
  const parsed = acquireSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  // requireRole throws redirect on unauthenticated. Only role='user' (or
  // higher) can reach /bookings/new — the (booking)/layout.tsx gates this.
  const session = await requireRole(['user', 'reception', 'housekeeper', 'manager', 'admin'], '/login?next=/bookings/new')

  const result = await acquireHold({
    userId: session.id,
    roomTypeId: parsed.data.roomTypeId,
    checkIn: parsed.data.checkIn,
    checkOut: parsed.data.checkOut,
    ttlMinutes: HOLD_TTL_MINUTES,
  })

  if (!result.ok) {
    return { ok: false, error: result.message }
  }

  // Set the cookie so subsequent mounts / actions can reference this hold.
  const cookieStore = await cookies()
  cookieStore.set(HOLD_COOKIE, result.hold.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: HOLD_TTL_MINUTES * 60,
    path: '/bookings',
  })

  return {
    ok: true,
    holdId: result.hold.id,
    expiresAt: result.hold.expires_at,
  }
}

/**
 * Best-effort release of the hold referenced by the `bh_id` cookie.
 * Called by the cancel/back button on /bookings/new + the success
 * path of createBooking (for symmetry — the RPC already DELETEs it
 * atomically, but clearing the cookie is the user's "I'm done" signal).
 *
 * Always returns `{ ok: true }` — release failures are not user-facing
 * errors; the TTL is the safety net.
 */
export async function releaseBookingHoldAction(): Promise<{ ok: true }> {
  try {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(HOLD_COOKIE)
    if (!cookie?.value) return { ok: true }

    // Read session for the userId scope check (RLS enforces owner-only
    // DELETE; we don't need to read it back into the action).
    const session = await requireRole(['user', 'reception', 'housekeeper', 'manager', 'admin'], '/login')
    await releaseHold(cookie.value, session.id)

    cookieStore.delete(HOLD_COOKIE)
  } catch {
    // swallow — best-effort
  }
  return { ok: true }
}
