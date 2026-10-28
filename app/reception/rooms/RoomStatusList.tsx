import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ROOM_STATUS_KEY, bucketWithGuest, type RoomBucket } from '@/components/manager/roomStatusBuckets'
import type { RoomUnitStatus } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

export interface RoomRow {
  id: string
  unit_label: string
  view_label: string | null
  status: string
  roomTypeName: string | null
  staying: { code: string; name: string } | null
}

const BUCKET_STYLE: Record<RoomBucket, { badge: string; icon: string }> = {
  available: { badge: 'bg-primary/10 text-primary', icon: 'check_circle' },
  occupied: { badge: 'bg-secondary/20 text-secondary', icon: 'group' },
  cleaning: { badge: 'bg-tertiary/10 text-tertiary', icon: 'cleaning_services' },
  closed: { badge: 'bg-error/10 text-error', icon: 'build' },
}

/**
 * One row per room: number, type, view, status — view only. Reception never
 * sets a room status: check-in / check-out and the housekeeping tasks move
 * it (check-out → waiting_cleaning → cleaning → ready), and the manager
 * closes / reopens rooms for maintenance.
 */
export function RoomStatusList({ rooms, locale }: { rooms: RoomRow[]; locale: Locale }) {
  const t = getT(locale)
  const statusLabel = (status: string) => {
    const key = ROOM_STATUS_KEY[status as RoomUnitStatus]
    return key ? t(key) : status
  }

  return (
    <div className="flex flex-col gap-2">
      {rooms.map((room) => {
        const style = BUCKET_STYLE[bucketWithGuest(room.status as RoomUnitStatus, !!room.staying)]
        return (
          <div
            key={room.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-surface-container-low rounded-xl"
          >
            <span className="font-mono text-body-md font-bold text-on-surface w-14 shrink-0">{room.unit_label}</span>
            <span className="flex-[2] min-w-40 text-body-md text-on-surface truncate">
              {room.roomTypeName ?? t('reception.common.roomFallback')}
              {room.view_label && <span className="text-caption text-on-surface-variant"> · {room.view_label}</span>}
            </span>
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${style.badge}`}>
              <MaterialIcon name={style.icon} size={14} />
              {room.staying && room.status !== 'occupied' ? t('staff.status.occupied') : statusLabel(room.status)}
            </span>
            {room.staying && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-on-surface-variant max-w-72 truncate">
                <MaterialIcon name="person" size={14} />
                {t('reception.roomsPage.guestStaying', { name: room.staying.name, code: room.staying.code })}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
