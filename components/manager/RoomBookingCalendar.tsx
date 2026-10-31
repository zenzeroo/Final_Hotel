import Link from 'next/link'
import type { RoomBookingRow } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { bookingHref } from './RoomBookingList'
import { addDaysIso, startOfWeekMondayIso } from '@/lib/dates'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface RoomBookingCalendarProps {
  /** YYYY-MM */
  month: string
  /** Bookings assigned to the room that overlap `month`. */
  bookings: RoomBookingRow[]
  /** Upcoming bookings of the room's type with no room yet, overlapping `month`. */
  unassigned: RoomBookingRow[]
  /** Bangkok YYYY-MM-DD */
  today: string
  /** The room shown; prev/next month links stay on its page. */
  roomId: string
  locale: Locale
}

const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Cell colours: a stay in this room vs. a booking of its type not yet given a room. */
const ASSIGNED_CELL = 'bg-primary-container text-on-primary-container'
const UNASSIGNED_CELL = 'bg-secondary-container text-on-secondary-container'
/** Codes listed per cell before collapsing the rest into "+N". */
const MAX_CODES = 2

const bookingsOn = (list: RoomBookingRow[], d: string) => list.filter((b) => b.checkIn <= d && d < b.checkOut)

/**
 * Monday-first month grid for /manager/rooms/[id]. A night `d` is booked when
 * `checkIn <= d < checkOut` (the check-out day itself is free for the next
 * guest). All dates are calendar strings, so no timezone can shift a day.
 * Each booked night shows its booking code(s), linking to the booking.
 */
export function RoomBookingCalendar({ month, bookings, unassigned, today, roomId, locale }: RoomBookingCalendarProps) {
  const t = getT(locale)
  const basePath = `/manager/rooms/${roomId}`
  const bcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const first = `${month}-01`
  const nextFirst = `${shiftMonth(month, 1)}-01`
  const lastDay = addDaysIso(nextFirst, -1)
  const gridStart = startOfWeekMondayIso(first)
  const gridEnd = addDaysIso(startOfWeekMondayIso(lastDay), 6)

  const days: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDaysIso(d, 1)) days.push(d)

  const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
  const title = new Intl.DateTimeFormat(bcp, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
    calendar: 'gregory',
  }).format(utc(first))
  // 2024-01-01 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(bcp, { weekday: 'short', timeZone: 'UTC' }).format(utc(addDaysIso('2024-01-01', i))),
  )
  const monthHref = (m: string) => `${basePath}?month=${m}`

  const navClass =
    'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-outline-variant text-on-surface hover:bg-primary-fixed transition-colors'

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      {/* ‹ month › centred over the grid; "this month" sits at the right. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <span aria-hidden />
        <div className="flex items-center gap-4">
          <Link href={monthHref(shiftMonth(month, -1))} className={navClass} aria-label={t('manager.roomDetail.prevMonth')}>
            <MaterialIcon name="chevron_left" size={18} />
          </Link>
          <h3 className="font-headline-sm text-headline-sm text-primary text-center min-w-40">{title}</h3>
          <Link href={monthHref(shiftMonth(month, 1))} className={navClass} aria-label={t('manager.roomDetail.nextMonth')}>
            <MaterialIcon name="chevron_right" size={18} />
          </Link>
        </div>
        <Link
          href={basePath}
          className="justify-self-end inline-flex items-center h-9 px-3 rounded-lg border border-outline-variant text-body-md text-on-surface hover:bg-primary-fixed transition-colors whitespace-nowrap"
        >
          {t('manager.roomDetail.thisMonth')}
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => (
          <div key={w} className="py-1 text-label-md uppercase tracking-wider text-on-surface-variant">
            {w}
          </div>
        ))}
        {days.map((d) => {
          if (d < first || d >= nextFirst) return <div key={d} className="min-h-16" aria-hidden />
          const mine = bookingsOn(bookings, d)
          const others = bookingsOn(unassigned, d)
          const shown = [...mine, ...others]
          const cell =
            mine.length > 0 ? ASSIGNED_CELL : others.length > 0 ? UNASSIGNED_CELL : 'bg-surface-container-low text-on-surface-variant'
          const ring = d === today ? 'ring-2 ring-secondary' : ''
          return (
            <div key={d} className={`min-h-16 rounded-md p-1 text-left ${cell} ${ring}`}>
              <span className={`block text-caption ${shown.length > 0 ? 'font-semibold' : ''}`}>{Number(d.slice(8))}</span>
              {shown.slice(0, MAX_CODES).map((b) => (
                <Link
                  key={b.id}
                  href={bookingHref(b.id, roomId)}
                  title={`${b.code} · ${b.guestName}`}
                  className="block text-caption truncate underline-offset-2 hover:underline"
                >
                  {b.code}
                </Link>
              ))}
              {shown.length > MAX_CODES && (
                <span className="block text-caption">+{shown.length - MAX_CODES}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-caption text-on-surface-variant">
        <p className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-sm ${ASSIGNED_CELL}`} aria-hidden />
          {t('manager.roomDetail.calendarLegend')}
        </p>
        <p className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-sm ${UNASSIGNED_CELL}`} aria-hidden />
          {t('manager.roomDetail.calendarLegendUnassigned')}
        </p>
      </div>
    </div>
  )
}
