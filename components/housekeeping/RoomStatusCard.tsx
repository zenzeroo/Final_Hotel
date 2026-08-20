import { StatusBadge } from './StatusBadge'
import { RoomStatusDropdown } from './RoomStatusDropdown'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { RoomUnitBasic } from '@/lib/data/types'

export function RoomStatusCard({ unit }: { unit: RoomUnitBasic }) {
  const canEdit = unit.status === 'cleaning' || unit.status === 'available'

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider">Floor {unit.floor}</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-primary">
            Room {unit.unit_label}
          </h3>
          {unit.room_type && (
            <p className="text-body-md text-on-surface-variant mt-1">
              {unit.room_type.name}
              {unit.view_label ? ` · ${unit.view_label}` : ''}
            </p>
          )}
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/30">
        <span className="text-caption text-on-surface-variant">
          {canEdit ? 'Toggle status' : 'Read-only (reception controls)'}
        </span>
        {canEdit ? (
          <RoomStatusDropdown unitId={unit.id} currentStatus={unit.status as 'cleaning' | 'available'} />
        ) : (
          <MaterialIcon name="lock" size={18} />
        )}
      </div>
    </div>
  )
}