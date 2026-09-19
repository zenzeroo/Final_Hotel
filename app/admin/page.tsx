import { getSession } from '@/lib/supabase/getSession'
import {
  getManagerDashboardStats,
  getBookingsOversight,
  listStaff,
} from '@/lib/data/manager'
import { KpiCard } from '@/components/manager/KpiCard'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

function today(localeBcp: string) {
  return new Date().toLocaleDateString(localeBcp, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
  })
}

/**
 * Format an ISO timestamp using the same calendar + verbosity as the
 * page header so dates in the Recent Activity table are visually
 * consistent with the header subtitle. Both use `calendar: 'gregory'`
 * to force the Gregorian year (avoiding the Buddhist-Era default
 * that `th-TH` would otherwise produce — which previously rendered
 * as "8/9/69" for the audit log).
 */
function formatTimestamp(iso: string, localeBcp: string): string {
  return new Date(iso).toLocaleString(localeBcp, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    calendar: 'gregory',
  })
}

export default async function AdminDashboard() {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const session = await getSession()
  const [stats, bookingsOversight, staff] = await Promise.all([
    getManagerDashboardStats(),
    getBookingsOversight(),
    listStaff(),
  ])

  const name = session?.fullName ?? 'Admin'
  // Canonical occupancy source of truth = `getManagerDashboardStats`
  // (lib/data/supabase-manager.ts:159-164). It counts bookings WHERE
  // check_in <= today AND check_out > today AND status IN (confirmed, checked_in)
  // — i.e. guests currently in-house.
  //
  // We deliberately do NOT derive occupancy from `room_units.status='occupied'`
  // because that column is only updated on manual reception check-in (via the
  // check-in server action + DB trigger), not on web bookings. Many in-house
  // guests still have `room_units.status='available'` until reception clicks
  // check-in, so the room-units-based count under-reports real occupancy.
  const occupancyPct = stats.occupancyRatePct
  const activeStaff = staff.filter((s) => s.is_active).length
  const pendingRefunds = bookingsOversight.refundRequests.length
  const recentActivity = bookingsOversight.auditLog.slice(0, 8)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('admin.title')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('nav.greeting')} {name} · {t('admin.title')} · {today(localeBcp)}
          </p>
        </div>
      </header>

      {/* 4 KPI tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <KpiCard label={t('manager.occupancy')} icon="hotel">
          <div className="flex items-center gap-3">
            <p className="font-display-lg text-display-lg-mobile text-primary">
              {occupancyPct}%
            </p>
            <div
              className="relative w-12 h-12 rounded-full"
              style={{
                background: `conic-gradient(#082717 ${occupancyPct * 3.6}deg, #e3e3df 0deg)`,
              }}
              aria-hidden
            >
              <div className="absolute inset-1 rounded-full bg-surface-container-lowest" />
            </div>
          </div>
        </KpiCard>

        <KpiCard label={t('bookings.title')} icon="bookmark">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {bookingsOversight.activeCount}
          </p>
          <div className="text-caption text-on-surface-variant mt-2">
            {pendingRefunds} {t('manager.bookingsPage.noRefunds')}
          </div>
        </KpiCard>

        <KpiCard label={t('manager.staffPage.title')} icon="badge">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {activeStaff}
          </p>
          <div className="text-caption text-on-surface-variant mt-2">
            {staff.length} {t('manager.staffPage.active')}
          </div>
        </KpiCard>

        <KpiCard label={`${t('manager.checkIns')} / ${t('manager.checkOuts')}`} icon="swap_horiz">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-display-lg text-display-lg-mobile text-primary">
                {stats.checkInsToday}
              </p>
              <p className="text-caption text-on-surface-variant">{t('manager.checkIns')}</p>
            </div>
            <div className="w-px h-10 bg-outline-variant" />
            <div>
              <p className="font-display-lg text-display-lg-mobile text-primary">
                {stats.checkOutsToday}
              </p>
              <p className="text-caption text-on-surface-variant">{t('manager.checkOuts')}</p>
            </div>
          </div>
        </KpiCard>
      </section>

      {/* Recent activity */}
      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-8 text-center text-on-surface-variant">
            {t('bookings.noBookings')}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    When
                  </th>
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    Staff
                  </th>
                  <th className="px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((entry, idx) => (
                  <tr
                    key={`${entry.timestamp}-${idx}`}
                    className="border-b border-outline-variant last:border-b-0"
                  >
                    <td className="px-4 py-3 text-body-md text-on-surface">
                      {formatTimestamp(entry.timestamp, localeBcp)}
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface-variant">
                      {entry.staffName ?? 'System'}
                      {entry.staffRole && (
                        <span className="text-caption text-on-surface-variant ml-1">
                          ({entry.staffRole})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface">
                      {entry.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
