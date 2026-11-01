import { formatDate } from '@/lib/dates'
import type { getT } from '@/lib/i18n/t'
import type { NotReadyReason } from '@/lib/room-status'

/**
 * One readable line for why a room can't take the guest yet. Shared by the
 * check-in-out list (room status column) and the check-in button's notes.
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
