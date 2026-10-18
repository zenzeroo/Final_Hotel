import type { RoomUnitStatus } from '@/lib/data/types'

/** The four KPI buckets on /manager/rates — every one of the 9 statuses lands in exactly one. */
export type RoomBucket = 'available' | 'occupied' | 'cleaning' | 'closed'

const BUCKET: Record<RoomUnitStatus, RoomBucket> = {
  available: 'available',
  ready: 'available',
  occupied: 'occupied',
  cleaning: 'cleaning',
  waiting_cleaning: 'cleaning',
  inspection: 'cleaning',
  checkout: 'cleaning',
  maintenance: 'closed',
  out_of_order: 'closed',
}

export function roomBucket(status: RoomUnitStatus): RoomBucket {
  return BUCKET[status]
}

/** A closed room is off sale until a manager reopens it. */
export const isClosedStatus = (status: RoomUnitStatus): boolean =>
  status === 'maintenance' || status === 'out_of_order'

/** Dictionary key for each room status label (Phase 27.E). */
export const ROOM_STATUS_KEY: Record<RoomUnitStatus, string> = {
  available: 'staff.status.available',
  ready: 'staff.status.ready',
  occupied: 'staff.status.occupied',
  cleaning: 'staff.status.cleaning',
  waiting_cleaning: 'staff.status.waiting_cleaning',
  inspection: 'staff.status.inspection',
  checkout: 'staff.status.checkout',
  maintenance: 'staff.status.maintenance',
  out_of_order: 'staff.status.out_of_order',
}
