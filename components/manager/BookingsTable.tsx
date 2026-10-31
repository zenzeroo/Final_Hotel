import type { BookingOversightRow } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { ManagerBookingRow } from './ManagerBookingRow'

interface BookingsTableProps {
  /** Rows of the current page. */
  bookings: BookingOversightRow[]
  page: number
  pageSize: number
  /** Rows across every page. */
  total: number
  locale: Locale
}

export function BookingsTable({ bookings, page, pageSize, total, locale }: BookingsTableProps) {
  const t = getT(locale)
  const first = (page - 1) * pageSize + 1
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary">{t('manager.bookingsTable.title')}</h3>
        {bookings.length > 0 && (
          <span className="text-caption text-on-surface-variant">
            {t('manager.bookingsTable.showing', { from: first, to: first + bookings.length - 1, total })}
          </span>
        )}
      </div>
      {/* Empty branch — guard against silent empty tbody on no-bookings DB.
          Previously rendered <table> with header + empty <tbody>. */}
      {bookings.length === 0 ? (
        <EmptyState
          icon="event_busy"
          title={t('manager.bookingsTable.emptyTitle')}
          description={t('manager.bookingsTable.emptyBody')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-md">
            <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant align-bottom">
              <tr>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colCode')}</th>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colGuest')}</th>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colCheckIn')}</th>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colCheckOut')}</th>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colRoom')}</th>
                <th className="py-3 pr-3">{t('manager.bookingsTable.colStatus')}</th>
                <th className="py-3">
                  <span className="sr-only">{t('manager.bookingsTable.colAction')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <ManagerBookingRow key={b.id} booking={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(total / pageSize)}
        basePath="/manager/bookings"
      />

    </div>
  )
}
