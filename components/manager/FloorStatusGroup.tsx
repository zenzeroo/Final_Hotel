import type { FloorStatusGroup as FloorStatusGroupType } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { RoomStatusCell } from './RoomStatusCell'

interface FloorStatusGroupProps {
  group: FloorStatusGroupType
  locale: Locale
}

export function FloorStatusGroup({ group, locale }: FloorStatusGroupProps) {
  const t = getT(locale)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="font-headline-sm text-headline-sm text-primary">
          {t('manager.housekeepingPage.floorN', { floor: group.floor })}
        </h4>
        <span className="text-caption text-on-surface-variant truncate">
          {group.assignedTo
            ? t('manager.housekeepingPage.assignedTo', { name: group.assignedTo })
            : t('manager.housekeepingPage.notAssigned')}
        </span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
        {group.rooms.map((r) => (
          <RoomStatusCell key={r.roomNumber} cell={r} locale={locale} />
        ))}
      </div>
    </div>
  )
}
