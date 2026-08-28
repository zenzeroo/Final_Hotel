import type { RoomType } from '@/lib/data/types'
import { RoomCard } from './RoomCard'

interface FloorGroupSectionProps {
  rooms: RoomType[]
}

export function FloorGroupSection({ rooms }: FloorGroupSectionProps) {
  // Group by floor
  const grouped = rooms.reduce<Record<number, RoomType[]>>((acc, room) => {
    const floor = room.floor
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})

  const floors = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)

  if (rooms.length === 0) {
    return (
      <div className="py-24 text-center">
        <h3 className="font-display text-2xl text-primary mb-2">ไม่พบห้องพัก</h3>
        <p className="text-body-md text-on-surface-variant">
          ลองปรับตัวกรองหรือเลือกชั้นอื่นเพื่อดูตัวเลือกเพิ่มเติม
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      {floors.map((floor) => (
        <section key={floor}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl text-primary">
              ชั้น {floor}
              {floor === 4 && (
                <span className="ml-3 text-label-md text-secondary font-semibold uppercase tracking-wider">
                  · ชั้นผู้บริหาร
                </span>
              )}
              {floor === 3 && (
                <span className="ml-3 text-label-md text-secondary font-semibold uppercase tracking-wider">
                  · วิวทะเล
                </span>
              )}
            </h2>
            <span className="text-caption text-on-surface-variant">
              {grouped[floor].length} ห้อง
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {grouped[floor].map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
