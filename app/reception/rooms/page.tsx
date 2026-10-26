import { getRoomsStatus } from '@/lib/data/staff'
import { RoomStatusList } from './RoomStatusList'
import { RoomFilterTabs } from './RoomFilterTabs'
import { bucketWithGuest, countRoomBuckets, filterToBucket } from '@/components/manager/roomStatusBuckets'
import type { RoomUnitStatus } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Reception room board: one row per room with its live `room_units.status`
 * (all 9 statuses) and a dropdown for the cleaning flow. Rooms with a guest
 * staying or closed for maintenance are locked (updateRoomStatus refuses
 * them too). Filters and counts use the shared buckets so they match the
 * reception dashboard.
 */
export default async function RoomsStatusPage(props: PageProps<'/reception/rooms'>) {
  const t = getT(await getLocale())
  const searchParams = await props.searchParams
  const filter = typeof searchParams.status === 'string' ? searchParams.status : 'all'
  const bucket = filterToBucket(filter)

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

  const counts = { all: rooms.length, ...countRoomBuckets(rooms) }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.roomsPage.title')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.roomsPage.subtitle', { rooms: rooms.length, floors: floors.length })}
        </p>
      </div>

      <RoomFilterTabs current={filter} counts={counts} />

      <div className="mt-6 flex flex-col gap-6">
        {floors.map((floor) => {
          const filtered = grouped[floor].filter(
            (r) => !bucket || bucketWithGuest(r.status as RoomUnitStatus, !!r.staying) === bucket,
          )
          if (filtered.length === 0) return null

          return (
            <section key={floor}>
              <h2 className="font-display text-xl text-primary mb-3">{t('reception.roomsPage.floorN', { floor })}</h2>
              <RoomStatusList
                rooms={filtered.map((r) => ({
                  id: r.id,
                  unit_label: r.unit_label,
                  view_label: r.view_label,
                  status: r.status,
                  roomTypeName: (Array.isArray(r.room_type) ? r.room_type[0] : r.room_type)?.name_th ?? null,
                  staying: r.staying,
                }))}
              />
            </section>
          )
        })}
      </div>
    </div>
  )
}
