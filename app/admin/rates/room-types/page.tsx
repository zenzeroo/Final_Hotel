import Link from 'next/link'
import { listRoomTypes } from '@/lib/data/rooms'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { RoomTypesAdminTable } from '@/components/admin/RoomTypesAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

type Tab = 'active' | 'inactive' | 'deleted'

const TAB_KEYS: readonly Tab[] = ['active', 'inactive', 'deleted']

export default async function AdminRoomTypesPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await props.searchParams
  const tab: Tab = (TAB_KEYS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as Tab)
    : 'active'

  // Parallel fetch all 3 lists — used both for the body table (the matching
  // list) AND the 3 tab badge counts. Cheap because each is a tiny filtered
  // count(*) query against an indexed column.
  const [activeList, inactiveList, deletedList] = await Promise.all([
    listRoomTypes({ isActive: true, isDeleted: false }),
    listRoomTypes({ isActive: false, isDeleted: false }),
    listRoomTypes({ isDeleted: true }),
  ])

  const roomTypes =
    tab === 'active' ? activeList : tab === 'inactive' ? inactiveList : deletedList

  const TABS: TabItem<Tab>[] = [
    {
      key: 'active',
      label: 'เปิดใช้งาน',
      href: '/admin/rates/room-types?tab=active',
      icon: 'check_circle',
      badge: activeList.length,
      badgeTone: 'primary',
    },
    {
      key: 'inactive',
      label: 'ปิดชั่วคราว',
      href: '/admin/rates/room-types?tab=inactive',
      icon: 'block',
      badge: inactiveList.length,
      badgeTone: 'default',
    },
    {
      key: 'deleted',
      label: 'ถูกลบ',
      href: '/admin/rates/room-types?tab=deleted',
      icon: 'delete',
      badge: deletedList.length,
      badgeTone: 'error',
    },
  ]

  const HEADER_SUBTITLE: Record<Tab, string> = {
    active: 'จัดการประเภทห้องที่เปิดให้จอง — แก้ไข / ปิดชั่วคราว / ลบ',
    inactive: 'ประเภทห้องที่ปิดการจองชั่วคราว — เปิดใช้งานกลับ / ย้ายไปถูกลบ',
    deleted: 'ประวัติประเภทห้องที่ถูกลบ — กู้คืน / ลบถาวร',
  }

  const SECTION_TITLE: Record<Tab, string> = {
    active: 'ประเภทห้องที่เปิดใช้งาน',
    inactive: 'ประเภทห้องที่ปิดชั่วคราว',
    deleted: 'ประวัติประเภทห้องที่ถูกลบ',
  }

  const totalAll = activeList.length + inactiveList.length + deletedList.length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            ประเภทห้อง
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {HEADER_SUBTITLE[tab]}
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
              {totalAll} ประเภท
            </span>
          </div>
        </div>
      </header>

      <Tabs<Tab> active={tab} tabs={TABS} />

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {SECTION_TITLE[tab]}
        </h2>
        <RoomTypesAdminTable roomTypes={roomTypes} tab={tab} />
      </section>
    </div>
  )
}
