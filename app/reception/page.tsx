import Link from 'next/link'
import { getTodayStats, getRecentBookings, getRoomsStatus } from '@/lib/data/staff'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

function formatDate(iso: string, localeBcp: string) {
  return new Intl.DateTimeFormat(localeBcp, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export default async function ReceptionDashboard() {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [stats, recent, rooms] = await Promise.all([
    getTodayStats(),
    getRecentBookings(5),
    getRoomsStatus(),
  ])

  const roomStats = {
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    cleaning: rooms.filter((r) => r.status === 'cleaning').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-primary">{t('reception.title')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t('reception.todayCheckIns')}
          value={stats.todayCheckIns}
          icon="login"
          color="primary"
        />
        <StatCard
          label={t('reception.todayCheckOuts')}
          value={stats.todayCheckOuts}
          icon="logout"
          color="secondary"
        />
        <StatCard
          label={t('reception.inHouse')}
          value={stats.inHouse}
          icon="group"
          color="primary"
        />
        <StatCard
          label={t('reception.pendingPayment')}
          value={stats.pendingPayment}
          icon="credit_card"
          color="error"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bookings */}
        <section className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-primary">{t('reception.bookingsPage.title')}</h2>
            <Link
              href="/reception/bookings"
              className="text-label-md text-primary font-semibold uppercase tracking-wider hover:text-secondary"
            >
              {t('reception.bookingsPage.addBooking')}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">{t('bookings.noBookings')}</p>
          ) : (
            <div className="flex flex-col">
              {recent.map((b) => (
                <Link
                  key={b.id}
                  href={`/reception/bookings`}
                  className="flex items-center gap-4 py-3 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-semibold text-on-surface truncate">
                      {b.booker_full_name}
                    </p>
                    <p className="text-caption text-on-surface-variant">
                      {b.room_type?.name_th} · {formatDate(b.check_in, localeBcp)} – {formatDate(b.check_out, localeBcp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-caption font-semibold ${statusClass(b.status, b.payment_status)}`}
                  >
                    {statusLabel(b.status, b.payment_status)}
                  </span>
                  <span className="shrink-0 text-body-md font-semibold text-primary">
                    {formatTHB(b.total, localeBcp)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Room Status */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">{t('reception.roomsPage.title')}</h2>
          <div className="flex flex-col gap-3">
            <RoomStat label={t('reception.available')} value={roomStats.available} total={rooms.length} color="primary" />
            <RoomStat label={t('reception.occupied')} value={roomStats.occupied} total={rooms.length} color="secondary" />
            <RoomStat label={t('reception.cleaning')} value={roomStats.cleaning} total={rooms.length} color="tertiary" />
            <RoomStat label={t('reception.maintenance')} value={roomStats.maintenance} total={rooms.length} color="error" />
          </div>
          <Link
            href="/reception/rooms"
            className="mt-4 inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider hover:text-secondary"
          >
            {t('reception.roomsPage.byFloor')}
            <MaterialIcon name="arrow_forward" size={16} />
          </Link>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: string
  color: 'primary' | 'secondary' | 'error'
}) {
  const colorClass =
    color === 'primary'
      ? 'bg-primary/10 text-primary'
      : color === 'secondary'
      ? 'bg-secondary/20 text-secondary'
      : 'bg-error/10 text-error'
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-(--shadow-ambient) border border-outline-variant transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</span>
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${colorClass}`}>
          <MaterialIcon name={icon} size={20} />
        </div>
      </div>
      <p className="font-display text-4xl font-bold text-primary">{value}</p>
    </div>
  )
}

function RoomStat({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: 'primary' | 'secondary' | 'tertiary' | 'error'
}) {
  const colorClass =
    color === 'primary'
      ? 'bg-primary'
      : color === 'secondary'
      ? 'bg-secondary'
      : color === 'tertiary'
      ? 'bg-tertiary'
      : 'bg-error'
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-body-md text-on-surface">{label}</span>
        <span className="text-body-md font-semibold text-on-surface">
          {value}/{total}
        </span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function statusLabel(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'checked_in') return 'Checked in'
  if (status === 'checked_out') return 'Checked out'
  if (paymentStatus === 'paid') return 'Paid'
  if (status === 'confirmed') return 'Pending payment'
  return 'Pending'
}

function statusClass(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_in') return 'bg-primary/10 text-primary'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}
