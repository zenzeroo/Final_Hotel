/**
 * Phase 40 — booking_holds data layer.
 *
 * Server-side only (uses supabase-js + cookies via server.ts).
 *
 * Holds reserve a `room_type_id`+date range for 10 minutes while a user
 * fills out /bookings/new. The hold prevents other users from booking the
 * same room+dates while the first user is mid-flow. Auto-expires via
 * `expires_at > now()` gating in availability queries (searchRooms +
 * create_booking RPC) — no cron required for correctness.
 *
 * Design notes:
 * - Partial unique index `WHERE expires_at > now()` is rejected by Postgres
 *   (`now()` is STABLE not IMMUTABLE). The migration uses a FULL unique
 *   index on (user_id, room_type_id, check_in, check_out) + an
 *   application-level cleanup pass (`cleanupExpiredHoldsForUser`) that
 *   runs before each acquire to keep the table size bounded.
 * - "One active hold per user+room+dates" semantic comes from the app:
 *   `acquireHold()` does `INSERT ... ON CONFLICT (user_id, room_type_id,
 *   check_in, check_out) DO UPDATE SET expires_at = EXCLUDED.expires_at`
 *   — the conflict key covers both active and expired rows, so ON CONFLICT
 *   refreshes TTL regardless of whether the existing row is still alive.
 *   The cleanup DELETE before INSERT ensures expired rows don't keep
 *   blocking ON CONFLICT resolution.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface BookingHold {
  id: string
  room_type_id: string
  room_unit_id: string | null
  check_in: string
  check_out: string
  user_id: string
  expires_at: string
  created_at: string
}

export interface AcquireHoldInput {
  userId: string
  roomTypeId: string
  checkIn: string
  checkOut: string
  /** Default 10 minutes per project spec. */
  ttlMinutes?: number
}

export type AcquireHoldResult =
  | { ok: true; hold: BookingHold }
  | { ok: false; reason: 'unavailable'; message: string }
  | { ok: false; reason: 'db_error'; message: string }

/**
 * Acquire (or refresh) a hold for `userId` on `roomTypeId` + dates.
 *
 * Pre-checks availability:
 * - counts bookings overlapping [checkIn, checkOut) for this room_type
 *   in {confirmed, checked_in} status
 * - counts other-user active holds (expires_at > now()) overlapping the range
 * - compares combined count against pool size (count of active room_units)
 * - if combined >= pool → return `{ ok: false, reason: 'unavailable' }`
 *
 * On success: fire-and-forget cleanup of the user's stale expired holds
 * for the same (roomTypeId, dates), then INSERT ... ON CONFLICT DO UPDATE
 * SET expires_at to refresh TTL.
 *
 * The pre-check is best-effort UX (hides the room in /rooms listings and
 * blocks the slot preemptively). The create_booking RPC is the
 * authoritative check — it locks room_units pool + bookings + holds under
 * FOR UPDATE, so a race between acquireHold and create_booking is caught
 * there with P0001.
 */
export async function acquireHold(input: AcquireHoldInput): Promise<AcquireHoldResult> {
  const supabase = await createClient()
  const ttlMinutes = input.ttlMinutes ?? 10

  // 1. Pre-check availability — global view (RLS can't read other users'
  //    holds, so we use the admin client). Mirrors `filterByAvailability`
  //    in lib/data/supabase-rooms.ts.
  try {
    const admin = await createAdminClient()
    const [unitsRes, bookingsRes, holdsRes] = await Promise.all([
      admin.from('room_units').select('room_type_id').eq('room_type_id', input.roomTypeId).eq('is_active', true),
      admin
        .from('bookings')
        .select('id')
        .eq('room_type_id', input.roomTypeId)
        .in('status', ['confirmed', 'checked_in'])
        .lte('check_in', input.checkOut)
        .gte('check_out', input.checkIn),
      admin
        .from('booking_holds')
        .select('id')
        .eq('room_type_id', input.roomTypeId)
        .neq('user_id', input.userId)
        .gt('expires_at', new Date().toISOString())
        .lte('check_in', input.checkOut)
        .gte('check_out', input.checkIn),
    ])

    const poolSize = unitsRes.data?.length ?? 0
    const activeBookings = bookingsRes.data?.length ?? 0
    const otherUserHolds = holdsRes.data?.length ?? 0

    if (poolSize === 0) {
      return { ok: false, reason: 'unavailable', message: 'ไม่มีห้องว่างในประเภทนี้' }
    }
    if (activeBookings + otherUserHolds >= poolSize) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'ห้องนี้เพิ่งถูกจองหรือถูกระงับชั่วคราวโดยผู้ใช้อื่น กรุณาลองใหม่',
      }
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'db_error',
      message: err instanceof Error ? err.message : String(err),
    }
  }

  // 2. Fire-and-forget cleanup of this user's stale expired holds for the
  //    same (room_type_id, dates) — keeps the table small + ensures
  //    ON CONFLICT below hits an unblocked unique key.
  await supabase
    .from('booking_holds')
    .delete()
    .eq('user_id', input.userId)
    .eq('room_type_id', input.roomTypeId)
    .eq('check_in', input.checkIn)
    .eq('check_out', input.checkOut)
    .lt('expires_at', new Date().toISOString())

  // 3. Acquire or refresh — full unique index on (user_id, room_type_id,
  //    check_in, check_out) ensures ON CONFLICT only matches the same key.
  //    We compute expires_at client-side; server-side RPC re-checks.
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('booking_holds')
    .upsert(
      {
        user_id: input.userId,
        room_type_id: input.roomTypeId,
        check_in: input.checkIn,
        check_out: input.checkOut,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id,room_type_id,check_in,check_out' },
    )
    .select()
    .single()

  if (error || !data) {
    return {
      ok: false,
      reason: 'db_error',
      message: error?.message ?? 'unknown error acquiring hold',
    }
  }

  return { ok: true, hold: data as BookingHold }
}

/**
 * Release (DELETE) a hold by id, scoped to userId for safety.
 * No-op if the hold doesn't exist or is already expired.
 */
export async function releaseHold(holdId: string, userId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('booking_holds')
    .delete()
    .eq('id', holdId)
    .eq('user_id', userId)

  return { ok: !error }
}

/**
 * Best-effort global cleanup of expired holds. Called periodically
 * (e.g. on /rooms search page mount) to keep the table size bounded by
 * user_count × TTL × orphan_rate. Safe to call repeatedly.
 */
export async function cleanupExpiredHolds(): Promise<number> {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('booking_holds')
    .delete()
    .lt('expires_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // >1h expired
    .select('id')

  if (error) return 0
  return data?.length ?? 0
}
