import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { RoomStatusCard } from '@/components/housekeeping/RoomStatusCard'
import type { RoomUnitStatus } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

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

/** Filter pill label: 'all' + `staff.status.*` (Phase 27.E). */
const filterLabelKey = (f: 'all' | FilterStatus) => (f === 'all' ? 'staff.filterAll' : `staff.status.${f}`)

export default async function RoomStatusOverview({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = getT(await getLocale())
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
        <h1 className="font-headline-md text-headline-md text-primary mb-2">{t('housekeeper.roomsPage.heading')}</h1>
        <p className="text-body-lg text-on-surface-variant">{t('housekeeper.roomsPage.subtitle')}</p>
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
            {t(filterLabelKey(f))}
          </a>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">{t('housekeeper.roomsPage.noMatchingRooms')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => <RoomStatusCard key={u.id} unit={u} />)}
        </div>
      )}
    </div>
  )
}