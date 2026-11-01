import { Tabs } from '@/components/ui/Tabs'
import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import type { RoomUnitBasic, RoomUnitStatus } from '@/lib/data/types'
import { localizedName } from '@/lib/format/roomType'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type FilterStatus = Exclude<RoomUnitStatus, 'ready'>

const STATUS_FILTERS: FilterStatus[] = [
  'waiting_cleaning',
  'checkout',
  'cleaning',
  'inspection',
  'available',
  'occupied',
  'maintenance',
  'out_of_order',
]

/** `ready` rooms are shown under "available" (same thing to a housekeeper). */
const matches = (u: RoomUnitBasic, f: 'all' | FilterStatus) =>
  f === 'all' || (f === 'available' ? u.status === 'available' || u.status === 'ready' : u.status === f)

/**
 * Read-only room board, grouped by floor so a housekeeper can scan the
 * floor they are on. Status tabs show only statuses that occur, each
 * with its count; rooms that need work come first.
 */
export default async function RoomStatusOverview({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const locale = await getLocale()
  const t = getT(locale)
  const params = await searchParams
  const filter: 'all' | FilterStatus = STATUS_FILTERS.includes(params.status as FilterStatus)
    ? (params.status as FilterStatus)
    : 'all'
  const units = await getAllRoomUnits()

  const chips = [
    { key: 'all' as const, label: t('staff.filterAll'), count: units.length },
    ...STATUS_FILTERS.map((f) => ({
      key: f,
      label: t(`staff.status.${f}`),
      count: units.filter((u) => matches(u, f)).length,
    })).filter((c) => c.count > 0 || c.key === filter),
  ]

  // Units arrive sorted by floor, then label.
  const floors: { floor: number; units: RoomUnitBasic[] }[] = []
  for (const u of units.filter((u) => matches(u, filter))) {
    const last = floors[floors.length - 1]
    if (last && last.floor === u.floor) last.units.push(u)
    else floors.push({ floor: u.floor, units: [u] })
  }
  const floorCount = new Set(units.map((u) => u.floor)).size

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12 max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
          {t('housekeeper.roomsPage.heading')}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('housekeeper.roomsPage.subtitle', { rooms: units.length, floors: floorCount })}
        </p>
      </header>

      <nav aria-label={t('housekeeper.roomsPage.filterLabel')} className="mb-2">
        <Tabs
          active={filter}
          tabs={chips.map((c) => ({
            key: c.key,
            label: c.label,
            href: c.key === 'all' ? '/housekeeper/rooms' : `/housekeeper/rooms?status=${c.key}`,
            badge: c.count,
          }))}
        />
      </nav>

      {floors.length === 0 ? (
        <p className="bg-surface-container-lowest rounded-2xl p-8 text-center text-body-md text-on-surface-variant">
          {t('housekeeper.roomsPage.noMatchingRooms')}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {floors.map(({ floor, units: floorUnits }) => (
            <section key={floor} aria-labelledby={`floor-${floor}`}>
              <div className="flex items-baseline justify-between gap-4 mb-3 px-1">
                <h2 id={`floor-${floor}`} className="text-body-lg font-semibold text-primary">
                  {t('staff.floorN', { floor })}
                </h2>
                <span className="text-[14px] text-on-surface-variant tabular-nums">
                  {t('housekeeper.roomsPage.roomCount', { count: floorUnits.length })}
                </span>
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {floorUnits.map((u) => (
                  <li key={u.id} className="bg-surface-container-lowest rounded-2xl p-4 md:p-5 flex flex-col gap-2">
                    <p className="font-display text-[22px] leading-[1.2] text-primary break-words">{u.unit_label}</p>
                    <div>
                      <StatusBadge status={u.status} />
                    </div>
                    {u.room_type && (
                      <p className="text-[14px] text-on-surface-variant leading-snug">
                        {localizedName(u.room_type, locale)}
                        {u.view_label ? ` · ${u.view_label}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
