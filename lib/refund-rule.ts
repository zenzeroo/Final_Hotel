import { addDaysIso, getTodayBangkok } from '@/lib/dates'

/**
 * Phase 57c — the guest-facing side of the refund rule: a full refund is
 * possible when asked at least `minDays` calendar days before check-in
 * (Asia/Bangkok). `minDays` comes from the DB (`getRefundMinDays()` →
 * refund_min_days_before_checkin()), which request_refund / cancel_booking
 * also use, so what we tell the guest matches what the server enforces.
 */

/** Last calendar day (YYYY-MM-DD) on which a full refund can still be asked. */
export function refundDeadlineIso(checkInIso: string, minDays: number): string {
  return addDaysIso(checkInIso, -minDays)
}

/** True while today (Bangkok) is on or before the refund deadline. */
export function isRefundable(
  checkInIso: string,
  minDays: number,
  todayIso: string = getTodayBangkok(),
): boolean {
  return refundDeadlineIso(checkInIso, minDays) >= todayIso
}

/** Deadline, or null when the booking is already inside the no-refund window. */
export function refundDeadlineOrNull(
  checkInIso: string,
  minDays: number,
  todayIso: string = getTodayBangkok(),
): string | null {
  return isRefundable(checkInIso, minDays, todayIso) ? refundDeadlineIso(checkInIso, minDays) : null
}
