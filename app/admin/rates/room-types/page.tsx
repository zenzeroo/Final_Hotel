import Link from 'next/link'
import { listRoomTypes, countUnitsByRoomType } from '@/lib/data/rooms'
import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { RoomTypesAdminTable } from '@/components/admin/RoomTypesAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'active' | 'inactive' | 'deleted'

const TAB_KEYS: readonly Tab[] = ['active', 'inactive', 'deleted']

export default async function AdminRoomTypesPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const t = getT(await getLocale())
  const { tab: rawTab } = await props.searchParams
  const tab: Tab = (TAB_KEYS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as Tab)
    : 'active'

  // Parallel fetch all 3 lists — used both for the body table (the matching
  // list) AND the 3 tab badge counts. Cheap because each is a tiny filtered
  // count(*) query against an indexed column.
  const [activeList, inactiveList, deletedList, unitCounts] = await Promise.all([
    listRoomTypes({ isActive: true, isDeleted: false }),
    listRoomTypes({ isActive: false, isDeleted: false }),
    listRoomTypes({ isDeleted: true }),
    countUnitsByRoomType(),
  ])

  const roomTypes =
    tab === 'active' ? activeList : tab === 'inactive' ? inactiveList : deletedList

  const TABS: TabItem<Tab>[] = [
    {
      key: 'active',
      label: t('admin.roomTypes.tabActive'),
      href: '/admin/rates/room-types?tab=active',
      icon: 'check_circle',
      badge: activeList.length,
      badgeTone: 'primary',
    },
    {
      key: 'inactive',
      label: t('admin.roomTypes.tabInactive'),
      href: '/admin/rates/room-types?tab=inactive',
      icon: 'block',
      badge: inactiveList.length,
      badgeTone: 'default',
    },
    {
      key: 'deleted',
      label: t('admin.roomTypes.tabDeleted'),
      href: '/admin/rates/room-types?tab=deleted',
      icon: 'delete',
      badge: deletedList.length,
      badgeTone: 'error',
    },
  ]

  const HEADER_SUBTITLE: Record<Tab, string> = {
    active: t('admin.roomTypes.subtitleActive'),
    inactive: t('admin.roomTypes.subtitleInactive'),
    deleted: t('admin.roomTypes.subtitleDeleted'),
  }

  const SECTION_TITLE: Record<Tab, string> = {
    active: t('admin.roomTypes.sectionActive'),
    inactive: t('admin.roomTypes.sectionInactive'),
    deleted: t('admin.roomTypes.sectionDeleted'),
  }

  const totalAll = activeList.length + inactiveList.length + deletedList.length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('admin.roomTypes.heading')}
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
            {t('admin.roomTypes.createNew')}
          </Link>
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="bed" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">
              {t('admin.roomTypes.countTypes', { count: totalAll })}
            </span>
          </div>
        </div>
      </header>

      <Tabs<Tab> active={tab} tabs={TABS} />

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {SECTION_TITLE[tab]}
        </h2>
        <RoomTypesAdminTable roomTypes={roomTypes} tab={tab} unitCounts={unitCounts} />
      </section>
    </div>
  )
}
