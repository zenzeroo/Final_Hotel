import type { RoomStatusCell as RoomStatusCellType } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

const STATUS_BG: Record<RoomStatusCellType['status'], string> = {
  dirty: 'bg-error-container text-on-error-container',
  cleaning: 'bg-secondary-container text-on-secondary-container',
  inspected: 'bg-primary-container text-on-primary-container',
}

const STATUS_LABEL: Record<RoomStatusCellType['status'], string> = {
  dirty: 'Dirty',
  cleaning: 'Cleaning',
  inspected: 'Ready',
}

interface RoomStatusCellProps {
  cell: RoomStatusCellType
}

export function RoomStatusCell({ cell }: RoomStatusCellProps) {
  return (
    <div
      className={`relative aspect-square rounded-md flex flex-col items-center justify-center text-center ${STATUS_BG[cell.status]}`}
      title={`Room ${cell.roomNumber} — ${STATUS_LABEL[cell.status]}${cell.occupied ? ' (occupied)' : ''}`}
    >
      <p className="font-headline-sm text-headline-sm leading-none">{cell.roomNumber}</p>
      <p className="text-[10px] uppercase tracking-wider mt-1 opacity-80">
        {STATUS_LABEL[cell.status]}
      </p>
      {cell.occupied ? (
        <MaterialIcon
          name="person"
          size={14}
          className="absolute top-1.5 right-1.5 opacity-80"
        />
      ) : null}
    </div>
  )
}
