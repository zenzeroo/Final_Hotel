import { getRoomsStatus } from '@/lib/data/staff'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { RoomStatusGrid } from './RoomStatusGrid'
import { RoomFilterTabs } from './RoomFilterTabs'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  available: { label: 'ว่าง', color: 'text-primary', bgColor: 'bg-primary/10 border-primary/30', icon: 'check_circle' },
  occupied: { label: 'มีแขก', color: 'text-secondary', bgColor: 'bg-secondary/20 border-secondary/30', icon: 'group' },
  cleaning: { label: 'รอทำความสะอาด', color: 'text-tertiary', bgColor: 'bg-tertiary/10 border-tertiary/30', icon: 'cleaning_services' },
  maintenance: { label: 'ปรับปรุง', color: 'text-error', bgColor: 'bg-error/10 border-error/30', icon: 'build' },
  out_of_order: { label: 'ปิดใช้งาน', color: 'text-on-surface-variant', bgColor: 'bg-surface-container border-outline-variant', icon: 'block' },
}

export default async function RoomsStatusPage(props: PageProps<'/reception/rooms'>) {
  const searchParams = await props.searchParams
  const filter = typeof searchParams.status === 'string' ? searchParams.status : 'all'

  const rooms = await getRoomsStatus()

  // Group by floor
  const grouped = rooms.reduce<Record<number, typeof rooms>>((acc, r) => {
    if (!acc[r.floor]) acc[r.floor] = []
    acc[r.floor].push(r)
    return acc
  }, {})

  const floors = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)

  const counts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    cleaning: rooms.filter((r) => r.status === 'cleaning').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">สถานะห้องพัก</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {rooms.length} ห้องทั้งหมด · {floors.length} ชั้น
        </p>
      </div>

      <RoomFilterTabs
        current={filter}
        counts={counts}
        statusMeta={STATUS_META}
      />

      <div className="mt-6 flex flex-col gap-6">
        {floors.map((floor) => {
          const floorRooms = grouped[floor]
          const filtered = filter === 'all' ? floorRooms : floorRooms.filter((r) => r.status === filter)

          if (filtered.length === 0) return null

          return (
            <section key={floor}>
              <h2 className="font-display text-xl text-primary mb-3">ชั้น {floor}</h2>
              <RoomStatusGrid rooms={filtered} statusMeta={STATUS_META} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
