import type { RoomStatusCell as RoomStatusCellType } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

export const STATUS_BG: Record<RoomStatusCellType['status'], string> = {
  dirty: 'bg-error-container text-on-error-container',
  cleaning: 'bg-secondary-container text-on-secondary-container',
  inspected: 'bg-primary-container text-on-primary-container',
}

export const STATUS_KEY: Record<RoomStatusCellType['status'], string> = {
  dirty: 'manager.housekeepingPage.cellDirty',
  cleaning: 'manager.housekeepingPage.cellCleaning',
  inspected: 'manager.housekeepingPage.cellReady',
}

interface RoomStatusCellProps {
  cell: RoomStatusCellType
  locale: Locale
}

/** Compact tile: room number only; status = colour (see legend), guest = dot. */
export function RoomStatusCell({ cell, locale }: RoomStatusCellProps) {
  const t = getT(locale)
  const label = t(STATUS_KEY[cell.status])
  const room = t('manager.housekeepingPage.roomN', { room: cell.roomNumber })
  const description = `${room} — ${label}${cell.occupied ? ` (${t('manager.housekeepingPage.cellHasGuest')})` : ''}`
  return (
    <div
      role="img"
      aria-label={description}
      title={description}
      className={`relative h-11 w-full rounded-md flex items-center justify-center text-label-md font-semibold tabular-nums ${STATUS_BG[cell.status]}`}
    >
      {cell.roomNumber}
      {cell.occupied ? (
        <span aria-hidden className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      ) : null}
    </div>
  )
}
