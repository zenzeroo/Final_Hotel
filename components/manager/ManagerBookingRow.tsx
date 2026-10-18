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
import { formatDate } from '@/lib/dates'
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
  const bcp = useLocale() === 'en' ? 'en-GB' : 'th-TH'
  const detailUrl = `/manager/bookings/${b.id}`

  return (
    <tr
      onClick={() => router.push(detailUrl)}
      className="border-b border-outline-variant last:border-b-0 hover:bg-primary-fixed transition-colors cursor-pointer"
    >
      <td className="py-3 pr-4 font-semibold text-primary">{b.code}</td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-caption font-semibold ${b.avatarBgClass}`}
          >
            {b.guestInitials}
          </span>
          <span className="text-on-surface">{b.guestName}</span>
        </div>
      </td>
      <td className="py-3 pr-4 text-on-surface">
        <span className="font-semibold">{t('manager.bookingsTable.roomN', { room: b.roomNumber })}</span>
        <span className="block text-caption text-on-surface-variant">{b.roomType}</span>
      </td>
      <td className="py-3 pr-4 text-on-surface-variant">
        {formatDate(b.checkIn, bcp)} – {formatDate(b.checkOut, bcp)}
        <span className="block text-caption">{t('manager.bookingsTable.nightsN', { count: b.nights })}</span>
      </td>
      <td className="py-3 pr-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption ${STATUS_CLASS[b.status]}`}>
          {t(STATUS_KEY[b.status])}
        </span>
      </td>
      <td className="py-3 pr-4">
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
