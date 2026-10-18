import type { BookingOversightRow } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ManagerBookingRow } from './ManagerBookingRow'

interface BookingsTableProps {
  bookings: BookingOversightRow[]
  activeCount: number
  locale: Locale
}

export function BookingsTable({ bookings, activeCount, locale }: BookingsTableProps) {
  const t = getT(locale)
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary">{t('manager.bookingsTable.title')}</h3>
        <span className="text-caption text-on-surface-variant">
          {t('manager.bookingsTable.showing', { shown: bookings.length, total: activeCount })}
        </span>
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
            <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
              <tr>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colCode')}</th>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colGuest')}</th>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colRoom')}</th>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colDates')}</th>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colStatus')}</th>
                <th className="py-3 pr-4">{t('manager.bookingsTable.colAction')}</th>
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
    </div>
  )
}
