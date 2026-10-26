/**
 * Room statuses that can take a check-in. The housekeeping flow ends a
 * cleaned room at 'ready' (Phase 31); 'available' is the original status
 * of rooms that never went through it. Check-in flips the room to
 * 'occupied'; check-out sends it to 'waiting_cleaning' (on_booking_checked_out).
 * Plain module — used by server pages and the check-in action.
 */
export const CHECK_IN_READY_STATUSES = ['available', 'ready'] as const

export function isCheckInReady(status: string): boolean {
  return (CHECK_IN_READY_STATUSES as readonly string[]).includes(status)
}

/**
 * Rooms reception can check a booking into: the booked room type's ready
 * room(s) — the default — and every other ready room, offered only when
 * the booked room has a problem ("ห้องมีปัญหา — เลือกห้องอื่น").
 * `bookedNotReady` = the booked type's rooms that can't take the guest yet
 * (e.g. still being cleaned / inspected), so reception sees why.
 */
export function splitCheckInUnits<T extends { roomTypeId: string | null; status: string }>(
  units: readonly T[],
  bookedRoomTypeId: string | null,
): { booked: T[]; others: T[]; bookedNotReady: T[] } {
  const ofBookedType = (u: T) => u.roomTypeId === bookedRoomTypeId
  return {
    booked: units.filter((u) => ofBookedType(u) && isCheckInReady(u.status)),
    others: units.filter((u) => !ofBookedType(u) && isCheckInReady(u.status)),
    bookedNotReady: units.filter((u) => ofBookedType(u) && !isCheckInReady(u.status)),
  }
}

/**
 * Statuses reception may set by hand on /reception/rooms (the cleaning
 * flow). occupied comes from check-in, and maintenance / out_of_order are
 * the manager's (Phase 31).
 */
export const RECEPTION_SETTABLE_STATUSES = ['waiting_cleaning', 'cleaning', 'ready'] as const
export type ReceptionSettableStatus = (typeof RECEPTION_SETTABLE_STATUSES)[number]

/**
 * Why a room's status can't be changed by hand: a guest is staying (status
 * 'occupied', or a checked-in booking points at it even if the status
 * drifted), or it is closed for maintenance. null = free to change.
 */
export function roomLockReason(status: string, hasCheckedInBooking: boolean): 'occupied' | 'closed' | null {
  if (hasCheckedInBooking || status === 'occupied') return 'occupied'
  if (status === 'maintenance' || status === 'out_of_order') return 'closed'
  return null
}
