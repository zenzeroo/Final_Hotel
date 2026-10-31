import Link from 'next/link'
import type { RoomBookingRow } from '@/lib/data/types'
import { TruncatedText } from '@/components/ui/TruncatedText'
import { LinkRow } from './LinkRow'
import { formatDate } from '@/lib/dates'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

/** Same wording as the guest's booking history (`bookings.status*`). */
function statusBadge(b: RoomBookingRow): { key: string; cls: string } {
  if (b.status === 'checked_in') return { key: 'bookings.statusCheckedIn', cls: 'bg-primary-container text-on-primary-container' }
  if (b.status === 'checked_out') return { key: 'bookings.statusCheckedOut', cls: 'bg-surface-variant text-on-surface-variant' }
  if (b.paymentStatus === 'paid') return { key: 'bookings.statusPaid', cls: 'bg-primary-container text-on-primary-container' }
  if (b.paymentStatus === 'unpaid') return { key: 'bookings.awaitingPayment', cls: 'bg-secondary-container text-on-secondary-container' }
  return { key: 'bookings.statusPending', cls: 'bg-secondary-container text-on-secondary-container' }
}

/** Booking detail opened from a room page; `room` makes its back link return here. */
export const bookingHref = (bookingId: string, roomId: string) =>
  `/manager/bookings/${bookingId}?room=${roomId}`

/** Compact booking table for /manager/rooms/[id]; clicking a row opens the booking. */
export function RoomBookingList({
  bookings,
  roomId,
  empty,
  locale,
}: {
  bookings: RoomBookingRow[]
  /** The room page this list sits on. */
  roomId: string
  /** Shown when there are no rows. */
  empty: string
  locale: Locale
}) {
  const t = getT(locale)
  const bcp = LOCALE_BCP47[locale] ?? 'th-TH'
  if (bookings.length === 0) {
    return <p className="text-body-md text-on-surface-variant italic py-4">{empty}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-md">
        <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant align-bottom">
          <tr>
            <th className="py-3 pr-3">{t('manager.bookingsTable.colCode')}</th>
            <th className="py-3 pr-3">{t('manager.bookingsTable.colGuest')}</th>
            <th className="py-3 pr-3">{t('manager.bookingsTable.colCheckIn')}</th>
            <th className="py-3 pr-3">{t('manager.bookingsTable.colCheckOut')}</th>
            <th className="py-3">{t('manager.bookingsTable.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const badge = statusBadge(b)
            const href = bookingHref(b.id, roomId)
            return (
              <LinkRow
                key={b.id}
                href={href}
                className="border-b border-outline-variant last:border-b-0 hover:bg-primary-fixed transition-colors align-top"
              >
                <td className="py-3 pr-3 whitespace-nowrap">
                  <Link href={href} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {b.code}
                  </Link>
                </td>
                <td className="py-3 pr-3">
                  <TruncatedText as="p" text={b.guestName} className="block max-w-44 text-on-surface" />
                  <p className="text-caption text-on-surface-variant [overflow-wrap:anywhere]">{b.guestEmail}</p>
                </td>
                <td className="py-3 pr-3 whitespace-nowrap text-on-surface">{formatDate(b.checkIn, bcp)}</td>
                <td className="py-3 pr-3 whitespace-nowrap text-on-surface">
                  {formatDate(b.checkOut, bcp)}
                  <span className="block text-caption text-on-surface-variant">
                    {t('manager.bookingsTable.nightsN', { count: b.nights })}
                  </span>
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption whitespace-nowrap ${badge.cls}`}>
                    {t(badge.key)}
                  </span>
                </td>
              </LinkRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
