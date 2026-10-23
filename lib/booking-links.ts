import { getTodayBangkok } from '@/lib/dates'

/**
 * Phase 58 — /rooms search link for "choose another room": keeps the
 * booking's dates and guests so the list shows what is free for that stay,
 * and drops the dates once the stay has passed.
 */
export function roomsSearchHref(
  booking: { check_in: string; check_out: string; guests: number },
  todayIso: string = getTodayBangkok(),
): string {
  if (booking.check_in < todayIso) return '/rooms'
  const params = new URLSearchParams({
    checkin: booking.check_in,
    checkout: booking.check_out,
    guests: String(booking.guests),
  })
  return `/rooms?${params}`
}
