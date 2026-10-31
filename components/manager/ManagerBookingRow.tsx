'use client'

/**
 * Phase 54 — one row of the /manager/bookings table. The whole row
 * navigates to `/manager/bookings/[id]` (same pattern as reception's
 * `BookingTableRow`); the eye icon is a real <Link> so keyboard users and
 * "open in new tab" still work. Its click stops propagation to avoid a
 * second, redundant router.push.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BookingOversightRow } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { TruncatedText } from '@/components/ui/TruncatedText'
import { formatBangkokDate, formatBangkokTime, formatDate } from '@/lib/dates'
import { useLocale, useT } from '@/lib/i18n/useT'

const STATUS_CLASS: Record<BookingOversightRow['status'], string> = {
  paid: 'bg-primary-container text-on-primary-container',
  pending: 'bg-secondary-container text-on-secondary-container',
  cancelled: 'bg-error-container text-on-error-container',
  refunded: 'bg-surface-variant text-on-surface-variant',
}

const STATUS_KEY: Record<BookingOversightRow['status'], string> = {
  paid: 'manager.bookingsTable.statusPaid',
  pending: 'manager.bookingsTable.statusPending',
  cancelled: 'manager.bookingsTable.statusCancelled',
  refunded: 'manager.bookingsTable.statusRefunded',
}

export function ManagerBookingRow({ booking: b }: { booking: BookingOversightRow }) {
  const router = useRouter()
  const t = useT()
  const detailUrl = `/manager/bookings/${b.id}`

  return (
    <tr
      onClick={() => router.push(detailUrl)}
      className="border-b border-outline-variant last:border-b-0 hover:bg-primary-fixed transition-colors cursor-pointer align-top"
    >
      {/* Cells wrap instead of widening the table, so every column fits the
          card without horizontal scrolling. */}
      <td className="py-3 pr-3 font-semibold text-primary whitespace-nowrap">{b.code}</td>
      <td className="py-3 pr-3">
        <div className="flex items-start gap-3">
          {/* Avatar only where there's room for it. */}
          <span
            className={`hidden 2xl:inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-full text-caption font-semibold ${b.avatarBgClass}`}
          >
            {b.guestInitials}
          </span>
          <div className="min-w-0">
            {/* Long names end in "…" (full name on hover); the max width is
                what stops the auto-sized cell from growing to fit them. */}
            <TruncatedText as="p" text={b.guestName} className="block max-w-44 text-on-surface" />
            <p className="text-caption text-on-surface-variant [overflow-wrap:anywhere]">{b.guestEmail}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-3">
        <StayTime at={b.checkedInAt} planned={b.checkIn} pendingKey="manager.bookingsTable.notCheckedIn" />
      </td>
      <td className="py-3 pr-3">
        <StayTime at={b.checkedOutAt} planned={b.checkOut} pendingKey="manager.bookingsTable.notCheckedOut" />
        <span className="block text-caption text-on-surface-variant">
          {t('manager.bookingsTable.nightsN', { count: b.nights })}
        </span>
      </td>
      <td className="py-3 pr-3 text-on-surface">
        <span className="font-semibold whitespace-nowrap">{t('manager.bookingsTable.roomN', { room: b.roomNumber })}</span>
        <span className="block text-caption text-on-surface-variant">{b.roomType}</span>
      </td>
      <td className="py-3 pr-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption whitespace-nowrap ${STATUS_CLASS[b.status]}`}>
          {t(STATUS_KEY[b.status])}
        </span>
      </td>
      <td className="py-3">
        <Link
          href={detailUrl}
          onClick={(e) => e.stopPropagation()}
          aria-label={t('manager.bookingsTable.viewDetails', { code: b.code })}
          title={t('manager.bookingsTable.viewDetails', { code: b.code })}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md text-primary hover:bg-primary hover:text-on-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <MaterialIcon name="visibility" size={18} />
        </Link>
      </td>
    </tr>
  )
}

/**
 * Actual check-in/out moment (Bangkok-pinned so server and browser render the
 * same string), or the booked date in muted text until it happens.
 */
function StayTime({ at, planned, pendingKey }: { at: string | null; planned: string; pendingKey: string }) {
  const t = useT()
  const bcp = useLocale() === 'en' ? 'en-GB' : 'th-TH'
  // Date and time on separate lines keeps the column narrow.
  if (at) {
    return (
      <span className="text-on-surface whitespace-nowrap">
        {formatBangkokDate(at, bcp)}
        <span className="block font-semibold">{formatBangkokTime(at, bcp)}</span>
      </span>
    )
  }
  return (
    <span className="text-on-surface-variant">
      <span className="whitespace-nowrap">{formatDate(planned, bcp)}</span>
      <span className="block text-caption italic">{t(pendingKey)}</span>
    </span>
  )
}
