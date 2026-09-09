import { listRoomUnits, listSeasonalRates } from '@/lib/data/manager'
import { RoomInventoryTable } from '@/components/manager/RoomInventoryTable'
import { SeasonalRatesPreview } from '@/components/manager/SeasonalRatesPreview'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function ManagerRatesPage() {
  const [units, seasonalRates] = await Promise.all([
    listRoomUnits(),
    listSeasonalRates(),
  ])

  const available = units.filter((u) => u.status === 'available').length
  const occupied = units.filter((u) => u.status === 'occupied').length
  const cleaning = units.filter((u) => u.status === 'cleaning').length
  const closed = units.filter(
    (u) => u.status === 'maintenance' || u.status === 'out_of_order',
  ).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            จัดการห้องและราคา
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ปิด/เปิดห้องพักและดูช่วงลดราคา — การแก้ไขห้องและราคาทำได้ผ่าน Admin
          </p>
        </div>
      </header>

      {/* Admin-only banner */}
      <section className="mb-8 bg-secondary-container rounded-lg p-4 flex items-start gap-3">
        <MaterialIcon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
        <div>
          <p className="text-body-md text-on-secondary-container font-medium">
            การแก้ไขห้องและราคาทำได้ผ่าน Admin เท่านั้น
          </p>
          <p className="text-caption text-on-secondary-container mt-0.5 opacity-80">
            หน้านี้แสดงสถานะห้องพักและให้ปิด/เปิดห้องได้ — การเพิ่มประเภทห้องและแก้ราคาต้องทำผ่าน Admin Portal
          </p>
        </div>
      </section>

      {/* 4-col KPI */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              ว่าง
            </p>
            <MaterialIcon name="check_circle" size={18} className="text-primary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-primary">{available}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              มีแขก
            </p>
            <MaterialIcon name="person" size={18} className="text-tertiary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-tertiary">{occupied}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              ทำความสะอาด
            </p>
            <MaterialIcon name="cleaning_services" size={18} className="text-secondary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{cleaning}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              ปิดใช้งาน
            </p>
            <MaterialIcon name="build" size={18} className="text-error" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-error">{closed}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          สถานะห้องพัก ({units.length} ห้อง)
        </h2>
        <RoomInventoryTable units={units} />
      </section>

      <section className="mb-8">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ช่วงลดราคา
        </h2>
        <SeasonalRatesPreview rates={seasonalRates} />
      </section>
    </div>
  )
}
