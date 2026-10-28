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
 * `movableTypeIds` = the types with room for this stay (movable_room_type_ids);
 * moving takes the room's type, so a fully booked type is never offered.
 * Omitted = no restriction.
 */
export function splitCheckInUnits<T extends { roomTypeId: string | null; status: string }>(
  units: readonly T[],
  bookedRoomTypeId: string | null,
  movableTypeIds?: ReadonlySet<string>,
): { booked: T[]; others: T[]; bookedNotReady: T[] } {
  const ofBookedType = (u: T) => u.roomTypeId === bookedRoomTypeId
  const canMoveTo = (u: T) => !movableTypeIds || (u.roomTypeId !== null && movableTypeIds.has(u.roomTypeId))
  return {
    booked: units.filter((u) => ofBookedType(u) && isCheckInReady(u.status)),
    others: units.filter((u) => !ofBookedType(u) && isCheckInReady(u.status) && canMoveTo(u)),
    bookedNotReady: units.filter((u) => ofBookedType(u) && !isCheckInReady(u.status)),
  }
}

/**
 * Why a room of the booked type can't take a check-in yet — shown under the
 * check-in button so reception knows whether to wait or move the guest.
 * Built from the room status plus the facts that explain it (who is staying,
 * who is cleaning, the open repair or damage report).
 */
export type NotReadyReason =
  | { kind: 'guest'; until: string | null }
  | { kind: 'waiting_cleaning'; by: string | null }
  | { kind: 'cleaning'; by: string | null }
  | { kind: 'inspection' }
  | { kind: 'repair'; detail: string | null }
  | { kind: 'damage'; detail: string }
  | { kind: 'status'; status: string }

export interface NotReadyFacts {
  /** check_out of a checked-in booking on the room, if any. */
  guestUntil?: string | null
  /** True when a checked-in booking points at the room. */
  hasGuest?: boolean
  /** Housekeeper on the room's open cleaning task. */
  cleanerName?: string | null
  /** Title of the newest open / in-progress maintenance report. */
  repairTitle?: string | null
  /** Description of the newest unresolved damage report. */
  damageDescription?: string | null
}

export function notReadyReason(status: string, facts: NotReadyFacts = {}): NotReadyReason {
  if (facts.hasGuest || status === 'occupied') return { kind: 'guest', until: facts.guestUntil ?? null }
  switch (status) {
    case 'waiting_cleaning':
    case 'checkout':
      return { kind: 'waiting_cleaning', by: facts.cleanerName ?? null }
    case 'cleaning':
      return { kind: 'cleaning', by: facts.cleanerName ?? null }
    case 'inspection':
      return { kind: 'inspection' }
    case 'maintenance':
    case 'out_of_order':
      if (facts.repairTitle) return { kind: 'repair', detail: facts.repairTitle }
      if (facts.damageDescription) return { kind: 'damage', detail: facts.damageDescription }
      return { kind: 'repair', detail: null }
    default:
      return { kind: 'status', status }
  }
}
