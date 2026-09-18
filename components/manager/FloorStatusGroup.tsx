import type { FloorStatusGroup as FloorStatusGroupType } from '@/lib/data/types'
import { RoomStatusCell } from './RoomStatusCell'

interface FloorStatusGroupProps {
  group: FloorStatusGroupType
}

export function FloorStatusGroup({ group }: FloorStatusGroupProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-headline-sm text-headline-sm text-primary">
          ชั้น {group.floor} — {group.label}
        </h4>
        <span className="text-caption text-on-surface-variant">
          {group.assignedTo ? `มอบหมายแล้ว` : 'ยังไม่ได้มอบหมาย'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {group.rooms.map((r) => (
          <RoomStatusCell key={r.roomNumber} cell={r} />
        ))}
      </div>
    </div>
  )
}
