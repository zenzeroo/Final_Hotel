import { listRoomTypes } from '@/lib/data/rooms'
import { listSeasonalRates } from '@/lib/data/manager'
import { Tabs } from '@/components/ui/Tabs'
import { RoomTypeForm } from '@/components/admin/RoomTypeForm'
import { RoomTypesAdminTable } from '@/components/admin/RoomTypesAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'room-types', label: 'ประเภทห้อง', href: '/admin/rates/room-types', icon: 'bed' },
  { key: 'seasonal-rates', label: 'อัตราตามฤดูกาล', href: '/admin/rates/seasonal-rates', icon: 'event' },
] as const

export default async function AdminRoomTypesPage() {
  const [roomTypes, seasonalRates] = await Promise.all([
    listRoomTypes(),
    listSeasonalRates(),
  ])

  const activeRoomTypes = roomTypes.filter((r) => r.is_active).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            ประเภทห้องและราคา
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            จัดการประเภทห้องและอัตราตามฤดูกาล — สร้าง / แก้ไข / เปิด-ปิด
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="bed" size={18} className="text-on-surface-variant" />
          <span className="text-body-md text-on-surface-variant">
            {roomTypes.length} ประเภท · {seasonalRates.length} ช่วงราคา
          </span>
        </div>
      </header>

      <Tabs<'room-types' | 'seasonal-rates'>
        active="room-types"
        tabs={[...TABS]}
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ประเภทห้องทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{roomTypes.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            เปิดให้จอง
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{activeRoomTypes}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ช่วงราคาทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{seasonalRates.length}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          สร้างประเภทห้องใหม่
        </h2>
        <RoomTypeForm mode="create" />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ประเภทห้องทั้งหมด
        </h2>
        <RoomTypesAdminTable roomTypes={roomTypes} />
      </section>
    </div>
  )
}
