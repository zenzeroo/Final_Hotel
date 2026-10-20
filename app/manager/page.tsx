import { getSession } from '@/lib/supabase/getSession'
import { getManagerDashboardStats } from '@/lib/data/manager'
import { KpiCard } from '@/components/manager/KpiCard'
import { RevenueBarChart } from '@/components/manager/RevenueBarChart'
import { AlertsPanel } from '@/components/manager/AlertsPanel'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getTodayBangkok } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Phase 54 — greeting + date are pinned to Asia/Bangkok. They used the
// server's clock/timezone (UTC on Vercel), so the greeting and date were
// wrong for the first 7 hours of the Thai day.
function today(localeBcp: string) {
  const weekday = new Intl.DateTimeFormat(localeBcp, { weekday: 'long', timeZone: 'Asia/Bangkok' }).format(new Date())
  const [y, m, d] = getTodayBangkok().split('-')
  return `${weekday} ${d}/${m}/${y}`
}

function greeting(t: ReturnType<typeof getT>): string {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(new Date()),
  )
  if (h < 12) return t('manager.greetingMorning')
  if (h < 18) return t('manager.greetingAfternoon')
  return t('manager.greetingEvening')
}

export default async function ManagerDashboard() {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const [session, stats] = await Promise.all([getSession(), getManagerDashboardStats()])
  const name = session?.fullName ?? t('nav.greeting')
  const trend = stats.revenueTrendPct

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {greeting(t)}, {name}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">{t('manager.subtitle')}</p>
        </div>
        {/* Today-date pill — TH date format is wider than EN; min-w keeps
            the pill from shrinking on language toggle. */}
        <div
          title={today(localeBcp)}
          className="inline-flex items-center gap-2 text-body-md text-on-surface-variant bg-surface-container-low rounded-full px-4 py-2 min-w-[180px] whitespace-nowrap"
        >
          <MaterialIcon name="calendar_today" size={18} className="flex-shrink-0" />
          <span className="truncate">{today(localeBcp)}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <KpiCard label={t('manager.todayRevenue')} icon="payments">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {formatTHB(stats.revenueToday, localeBcp)}
          </p>
          {trend === null ? (
            <p className="mt-2 text-caption text-on-surface-variant">{t('manager.noYesterdayData')}</p>
          ) : (
            <div
              className={`flex items-center gap-1 mt-2 text-caption ${trend < 0 ? 'text-error' : 'text-secondary'}`}
            >
              <MaterialIcon name={trend < 0 ? 'trending_down' : trend > 0 ? 'trending_up' : 'trending_flat'} size={14} />
              {trend > 0 ? '+' : ''}
              {trend.toFixed(1)}% {t('manager.vsYesterday')}
            </div>
          )}
        </KpiCard>

        <KpiCard label={t('manager.occupancy')} icon="hotel">
          <div className="flex items-center gap-3">
            <p className="font-display-lg text-display-lg-mobile text-primary">
              {stats.occupancyRatePct}%
            </p>
            <div
              className="relative w-12 h-12 rounded-full"
              style={{
                background: `conic-gradient(var(--color-primary) ${stats.occupancyRatePct * 3.6}deg, var(--color-surface-variant) 0deg)`,
              }}
              aria-hidden
            >
              <div className="absolute inset-1 rounded-full bg-surface-container-lowest" />
            </div>
          </div>
        </KpiCard>

        <KpiCard label={t('manager.checkIns') + ' / ' + t('manager.checkOuts')} icon="swap_horiz">
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

        <KpiCard label={t('manager.newBookings')} icon="bookmark_added" tone="gold">
          <p className="font-display-lg text-display-lg-mobile text-on-secondary-container">
            {stats.newBookingsToday}
          </p>
          <div className="flex items-center gap-3 mt-2 text-caption text-on-secondary-container">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" /> {t('manager.webBookings')} {stats.webBookings}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-tertiary" /> {t('manager.walkInBookings')} {stats.walkInBookings}
            </span>
          </div>
        </KpiCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueBarChart data7d={stats.revenue7d} data30d={stats.revenue30d} className="lg:col-span-2" />
        <AlertsPanel alerts={stats.alerts} locale={locale} />
      </section>
    </div>
  )
}
