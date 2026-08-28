'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomTypeSummary {
  name_th: string
}

interface Room {
  id: string
  floor: number
  unit_label: string
  view_label: string | null
  status: string
  room_type: RoomTypeSummary[]
}

interface RoomStatusGridProps {
  rooms: Room[]
  statusMeta: Record<string, { label: string; color: string; bgColor: string; icon: string }>
}

const NEXT_STATUS: Record<string, string> = {
  available: 'cleaning',
  cleaning: 'available',
  occupied: 'cleaning',
  maintenance: 'available',
}

export function RoomStatusGrid({ rooms, statusMeta }: RoomStatusGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (roomId: string, currentStatus: string) => {
    const next = NEXT_STATUS[currentStatus] ?? 'available'
    startTransition(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { error } = await supabase
        .from('room_units')
        .update({ status: next })
        .eq('id', roomId)

      if (error) {
        alert('ไม่สามารถอัปเดต: ' + error.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {rooms.map((room) => {
        const meta = statusMeta[room.status] ?? statusMeta.available
        return (
          <button
            key={room.id}
            type="button"
            onClick={() => handleStatusChange(room.id, room.status)}
            disabled={isPending}
            className={`text-left p-4 rounded-2xl border-2 ${meta.bgColor} transition-all hover:shadow-(--shadow-ambient) disabled:opacity-50`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-body-md font-bold ${meta.color}`}>
                {room.unit_label}
              </span>
              <MaterialIcon name={meta.icon} size={18} className={meta.color} />
            </div>
            <p className="text-caption text-on-surface-variant truncate">
              {room.room_type?.[0]?.name_th ?? 'ห้องพัก'}
            </p>
            <p className={`text-caption font-semibold mt-1 ${meta.color}`}>{meta.label}</p>
            {room.view_label && (
              <p className="text-caption text-on-surface-variant mt-1 truncate">{room.view_label}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
