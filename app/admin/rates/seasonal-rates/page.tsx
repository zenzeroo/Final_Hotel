import { listRoomTypes } from '@/lib/data/rooms'
import { listSeasonalRates } from '@/lib/data/manager'
import { Tabs } from '@/components/ui/Tabs'
import { SeasonalRateForm } from '@/components/admin/SeasonalRateForm'
import { SeasonalRatesAdminTable } from '@/components/admin/SeasonalRatesAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'room-types', label: 'ประเภทห้อง', href: '/admin/rates/room-types', icon: 'bed' },
  { key: 'seasonal-rates', label: 'ช่วงลดราคา', href: '/admin/rates/seasonal-rates', icon: 'event' },
] as const

export default async function AdminSeasonalRatesPage() {
  const [roomTypes, seasonalRates] = await Promise.all([
    listRoomTypes(),
    listSeasonalRates(),
  ])

  const nowMs = new Date('2026-08-23T00:00:00Z').getTime()
  const activeCount = seasonalRates.filter((r) => {
    const start = new Date(r.start_date).getTime()
    const end = new Date(r.end_date).getTime()
    return r.is_active && start <= nowMs && nowMs <= end
  }).length
  const upcomingCount = seasonalRates.filter(
    (r) => r.is_active && new Date(r.start_date).getTime() > nowMs,
  ).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            ประเภทห้องและราคา
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            จัดการประเภทห้องและช่วงลดราคา — สร้าง / แก้ไข / เปิด-ปิด
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="event" size={18} className="text-on-surface-variant" />
          <span className="text-body-md text-on-surface-variant">
            {seasonalRates.length} ช่วงราคา
          </span>
        </div>
      </header>

      <Tabs<'room-types' | 'seasonal-rates'>
        active="seasonal-rates"
        tabs={[...TABS]}
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ช่วงราคาทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{seasonalRates.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            กำลังใช้งาน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            เร็วๆ นี้
          </p>
          <p className="font-display-lg text-display-lg-mobile text-tertiary">{upcomingCount}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          สร้างช่วงราคาใหม่
        </h2>
        <SeasonalRateForm mode="create" roomTypes={roomTypes} />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ช่วงราคาทั้งหมด
        </h2>
        <SeasonalRatesAdminTable rates={seasonalRates} />
      </section>
    </div>
  )
}
