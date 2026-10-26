import { getTodayBangkok } from '@/lib/dates'

/**
 * Guest-facing only: a confirmed booking whose check-in day has passed
 * (Asia/Bangkok) without a check-in. Nothing is written to the DB — the
 * booking stays `confirmed`, so reception can still check in a late guest
 * (the row then becomes a normal `checked_in` one).
 */
export function isNoShow(
  status: string,
  checkInIso: string,
  todayIso: string = getTodayBangkok(),
): boolean {
  return status === 'confirmed' && checkInIso < todayIso
}
