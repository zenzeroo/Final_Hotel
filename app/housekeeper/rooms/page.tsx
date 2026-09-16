import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { RoomStatusCard } from '@/components/housekeeping/RoomStatusCard'
import type { RoomUnitStatus } from '@/lib/data/types'

export const dynamic = 'force-dynamic'

type FilterStatus = Exclude<RoomUnitStatus, 'ready'>

const STATUS_FILTERS: ('all' | FilterStatus)[] = [
  'all',
  'available',
  'occupied',
  'cleaning',
  'waiting_cleaning',
  'inspection',
  'checkout',
  'maintenance',
  'out_of_order',
]

const STATUS_FILTER_LABELS: Record<'all' | FilterStatus, string> = {
  all: 'ทั้งหมด',
  available: 'ว่าง',
  occupied: 'มีแขก',
  cleaning: 'กำลังทำความสะอาด',
  maintenance: 'ปิดซ่อมบำรุง',
  out_of_order: 'ปิดใช้งาน',
  // Phase 30.1 — DB CHECK widened to include these 4 new values.
  waiting_cleaning: 'รอทำคว�สะอาด',
  inspection: 'กำลังตรวจสอบ',
  checkout: 'เช็คเอาท์แล้ว',
}

export default async function RoomStatusOverview({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const filter = ((params.status as string) || 'all') as 'all' | RoomUnitStatus
  const units = await getAllRoomUnits()
  const filtered = units.filter(u =>
    filter === 'all' ||
    (filter === 'available' ? u.status === 'available' || u.status === 'ready' : u.status === filter),
  )

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">ภาพรวมสถานะห้อง</h1>
        <p className="text-body-lg text-on-surface-variant">ห้องพักทุกห้องและสถานะปัจจุบัน</p>
      </header>

      <nav className="flex gap-2 mb-8 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/housekeeper/rooms' : `/housekeeper/rooms?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {STATUS_FILTER_LABELS[f]}
          </a>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">ไม่มีห้องที่ตรงกับตัวกรองนี้</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => <RoomStatusCard key={u.id} unit={u} />)}
        </div>
      )}
    </div>
  )
}