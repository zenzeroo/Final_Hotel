import Link from 'next/link'
import { getTodayStats, getRecentBookings, getRoomsStatus } from '@/lib/data/staff'
import { RoomStatusSummary } from '@/components/manager/RoomStatusSummary'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatDate } from '@/lib/dates'
import { localizedName } from '@/lib/format/roomType'

export const dynamic = 'force-dynamic'

export default async function ReceptionDashboard() {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [stats, recent, rooms] = await Promise.all([
    getTodayStats(),
    getRecentBookings(5),
    getRoomsStatus(),
  ])

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">{t('reception.title')}</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{t('reception.subtitle')}</p>
      </header>

      {/* Each figure opens the list it counts. */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('reception.todayCheckIns')} value={stats.todayCheckIns} href="/reception/check-in-out" />
        <StatCard
          label={t('reception.todayCheckOuts')}
          value={stats.todayCheckOuts}
          href="/reception/check-in-out?tab=checkout"
        />
        <StatCard label={t('reception.inHouse')} value={stats.inHouse} href="/reception/check-in-out?view=inhouse" />
        <StatCard label={t('reception.pendingPayment')} value={stats.pendingPayment} tone="text-error" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-headline-sm text-headline-sm text-primary">{t('reception.bookingsPage.title')}</h2>
            <Link
              href="/reception/bookings/new"
              className="inline-flex items-center gap-1 text-body-md font-semibold text-primary px-2 py-1 rounded hover:bg-primary-fixed"
            >
              <MaterialIcon name="add" size={18} />
              {t('reception.bookingsPage.addBooking')}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">{t('bookings.noBookings')}</p>
          ) : (
            <div className="flex flex-col">
              {recent.map((b) => {
                const status = bookingStatus(b.status, b.payment_status)
                return (
                  <Link
                    key={b.id}
                    href={`/reception/bookings/${b.id}?from=dashboard`}
                    className="flex items-center gap-4 py-3 border-b border-outline-variant last:border-0 hover:bg-primary-fixed transition-colors -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-semibold text-on-surface truncate">{b.booker_full_name}</p>
                      <p className="text-caption text-on-surface-variant">
                        {localizedName(b.room_type, locale)} · {formatDate(b.check_in, localeBcp)} –{' '}
                        {formatDate(b.check_out, localeBcp)}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-caption font-semibold ${status.cls}`}>
                      {t(status.key)}
                    </span>
                    <span className="shrink-0 text-body-md font-semibold text-primary">
                      {formatTHB(b.total, localeBcp)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">{t('reception.roomsPage.title')}</h2>
          <RoomStatusSummary rooms={rooms} locale={locale} href="/reception/rooms" />
        </section>
      </div>
    </div>
  )
}

/** A label and a number; with `href` the whole card opens that list. */
function StatCard({
  label,
  value,
  href,
  tone = 'text-primary',
}: {
  label: string
  value: number
  href?: string
  tone?: string
}) {
  const body = (
    <>
      <p className="text-body-md text-on-surface-variant mb-2">{label}</p>
      <p className={`font-display-lg text-display-lg-mobile ${tone}`}>{value}</p>
    </>
  )
  const card = 'block bg-surface-container-lowest rounded-lg shadow-level-1 p-5'
  return href ? (
    <Link href={href} className={`${card} hover:bg-primary-fixed transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  )
}

/** Same wording as the guest's booking history (`bookings.status*`). */
function bookingStatus(status: string, paymentStatus: string): { key: string; cls: string } {
  if (status === 'cancelled') return { key: 'bookings.statusCancelled', cls: 'bg-error/10 text-error' }
  if (status === 'checked_in') return { key: 'bookings.statusCheckedIn', cls: 'bg-primary/10 text-primary' }
  if (status === 'checked_out') {
    return { key: 'bookings.statusCheckedOut', cls: 'bg-surface-container text-on-surface-variant' }
  }
  if (paymentStatus === 'paid') return { key: 'bookings.statusPaid', cls: 'bg-primary/10 text-primary' }
  if (status === 'confirmed') return { key: 'bookings.awaitingPayment', cls: 'bg-secondary/20 text-secondary' }
  return { key: 'bookings.statusPending', cls: 'bg-secondary/20 text-secondary' }
}
