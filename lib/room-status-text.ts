import { formatDate } from '@/lib/dates'
import type { getT } from '@/lib/i18n/t'
import type { NotReadyReason, RoomPlan } from '@/lib/room-status'

/**
 * One readable line for why a room can't take the guest yet. Shared by the
 * check-in-out list, the manager dashboard and the check-in button's notes.
 */
export function reasonText(r: NotReadyReason, t: ReturnType<typeof getT>): string {
  switch (r.kind) {
    case 'guest':
      return r.until
        ? t('reception.checkInOutPage.reasonGuestUntil', { date: formatDate(r.until) })
        : t('reception.checkInOutPage.reasonGuest')
    case 'waiting_cleaning':
      return r.by
        ? t('reception.checkInOutPage.reasonWaitingCleaningBy', { name: r.by })
        : t('reception.checkInOutPage.reasonWaitingCleaning')
    case 'cleaning':
      return r.by ? t('reception.checkInOutPage.reasonCleaningBy', { name: r.by }) : t('reception.checkInOutPage.reasonCleaning')
    case 'inspection':
      return t('reception.checkInOutPage.reasonInspection')
    case 'repair':
      return r.detail ? t('reception.checkInOutPage.reasonRepairWith', { detail: r.detail }) : t('reception.checkInOutPage.reasonRepair')
    case 'damage':
      return t('reception.checkInOutPage.reasonDamage', { detail: r.detail })
    case 'status':
      return t(`staff.status.${r.status}`)
  }
}

/** Room column + one-line room status for a booking row. */
export interface RoomNote {
  room: string
  note: string
  /** ready = free for the guest; problem = can't take them yet; stay = guest in it. */
  tone: 'ready' | 'problem' | 'stay'
}

/** Text for a planRooms() result; `reasons` comes from getRoomNotReadyReasons(). */
export function roomPlanNote(
  plan: RoomPlan,
  reasons: Record<string, NotReadyReason>,
  t: ReturnType<typeof getT>,
  checkOut: string,
  bcp: string,
): RoomNote {
  switch (plan.kind) {
    case 'staying':
      return {
        room: plan.room ?? '—',
        note: t('reception.checkInOutPage.inHouseUntil', { date: formatDate(checkOut, bcp) }),
        tone: 'stay',
      }
    case 'ready':
      return { room: plan.room, note: t('reception.checkInOutPage.roomReady'), tone: 'ready' }
    case 'blocked':
      return {
        room: plan.room,
        note: reasonText(reasons[plan.unitId] ?? { kind: 'status', status: plan.status }, t),
        tone: 'problem',
      }
    case 'none':
      return { room: '—', note: t('reception.checkInOutPage.noRoomLeft'), tone: 'problem' }
  }
}
