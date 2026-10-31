import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRoomUnitDetail } from '@/lib/data/manager'
import { CloseRoomButton } from '@/components/manager/CloseRoomButton'
import { RoomBookingCalendar } from '@/components/manager/RoomBookingCalendar'
import { RoomBookingList } from '@/components/manager/RoomBookingList'
import { STATUS_LABEL } from '@/components/manager/RoomInventoryTable'
import { ROOM_STATUS_KEY } from '@/components/manager/roomStatusBuckets'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getTodayBangkok } from '@/lib/dates'
import { isUuid } from '@/lib/ids'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * One room: which nights it has a guest (calendar + list of bookings assigned
 * to it) and the upcoming bookings of its type that get a room at check-in.
 */
export default async function ManagerRoomDetailPage(props: PageProps<'/manager/rooms/[id]'>) {
  const { id } = await props.params
  if (!isUuid(id)) notFound()
  const sp = await props.searchParams
  const today = getTodayBangkok()
  const monthParam = param(sp.month)
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : today.slice(0, 7)

  const [detail, locale] = await Promise.all([getRoomUnitDetail(id, month), getLocale()])
  if (!detail) notFound()
  const t = getT(locale)
  const { unit } = detail
  const status = STATUS_LABEL[unit.status]
  const typeName = locale === 'th' && unit.room_type.name_th ? unit.room_type.name_th : unit.room_type.name

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <Link
        href="/manager/rooms"
        className="inline-flex items-center gap-1 mb-6 text-body-md text-primary underline-offset-4 hover:underline"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('manager.roomDetail.back')}
      </Link>

      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('manager.bookingsTable.roomN', { room: unit.unit_label })}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {typeName} · {t('manager.roomsTable.floorN', { floor: unit.floor })}
            {unit.view_label && <> · {t('manager.roomsTable.colView')} {unit.view_label}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-caption font-semibold ${status.chip}`}
          >
            <MaterialIcon name={status.icon} size={14} />
            {t(ROOM_STATUS_KEY[unit.status])}
          </span>
          <CloseRoomButton unitId={unit.id} status={unit.status} />
        </div>
      </header>

      <section className="mb-8">
        <RoomBookingCalendar
          month={month}
          bookings={detail.monthBookings}
          unassigned={detail.monthUnassigned}
          today={today}
          roomId={unit.id}
          locale={locale}
        />
      </section>

      <section className="mb-8 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-2">
          {t('manager.roomDetail.assignedHeading')}
        </h2>
        <RoomBookingList
          bookings={detail.assigned}
          roomId={unit.id}
          empty={t('manager.roomDetail.assignedEmpty')}
          locale={locale}
        />
      </section>

      <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary">
          {t('manager.roomDetail.upcomingHeading', { type: typeName })}
        </h2>
        <p className="text-caption text-on-surface-variant mt-1 mb-2">{t('manager.roomDetail.upcomingHint')}</p>
        <RoomBookingList
          bookings={detail.upcomingUnassigned}
          roomId={unit.id}
          empty={t('manager.roomDetail.upcomingEmpty')}
          locale={locale}
        />
      </section>
    </div>
  )
}
