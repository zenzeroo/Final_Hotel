import Link from 'next/link'
import { listRoomTypes } from '@/lib/data/rooms'
import { Tabs } from '@/components/ui/Tabs'
import { RoomTypesAdminTable } from '@/components/admin/RoomTypesAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'room-types', label: 'ประเภทห้อง', href: '/admin/rates/room-types', icon: 'bed' },
] as const

export default async function AdminRoomTypesPage() {
  const roomTypes = await listRoomTypes()

  const activeRoomTypes = roomTypes.filter((r) => r.is_active).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            ประเภทห้อง
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            จัดการประเภทห้องพักและราคาฐาน — สร้าง / แก้ไข / เปิด-ปิด / ลบ
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/rates/room-types/new"
            className="inline-flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <MaterialIcon name="add" size={18} />
            สร้างประเภทห้องใหม่
          </Link>
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="bed" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">
              {roomTypes.length} ประเภท
            </span>
          </div>
        </div>
      </header>

      <Tabs<'room-types'>
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
            ปิดให้จอง
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">
            {roomTypes.length - activeRoomTypes}
          </p>
        </div>
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
