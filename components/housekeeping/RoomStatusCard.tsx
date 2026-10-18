'use client'

import { StatusBadge } from './StatusBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { RoomUnitBasic } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'

export function RoomStatusCard({ unit }: { unit: RoomUnitBasic }) {
  const t = useT()
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30 flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider">{t('staff.floorN', { floor: unit.floor })}</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-primary truncate">
            {t('staff.roomN', { room: unit.unit_label })}
          </h3>
          {unit.room_type && (
            <p className="text-body-md text-on-surface-variant mt-1 line-clamp-1 mb-0">
              {unit.room_type.name}
              {unit.view_label ? ` · ${unit.view_label}` : ''}
            </p>
          )}
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/30 mt-auto">
        <span className="text-caption text-on-surface-variant min-w-0 truncate">
          {t('housekeeper.roomsPage.readOnly')}
        </span>
        <div className="flex-shrink-0 ml-2">
          <MaterialIcon name="lock" size={18} />
        </div>
      </div>
    </div>
  )
}
