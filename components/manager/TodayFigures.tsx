import Link from 'next/link'
import type { ManagerDashboardStats } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

/** Today's four figures as plain type; each opens the page it summarises. */
export function TodayFigures({ stats, locale }: { stats: ManagerDashboardStats; locale: Locale }) {
  const t = getT(locale)
  const bcp = LOCALE_BCP47[locale]
  const trend = stats.revenueTrendPct
  const figures = [
    {
      label: t('manager.todayRevenue'),
      value: formatTHB(stats.revenueToday, bcp),
      note:
        trend === null
          ? t('manager.noYesterdayData')
          : `${trend > 0 ? '+' : ''}${trend.toFixed(1)}% ${t('manager.vsYesterday')}`,
      noteTone: trend !== null && trend < 0 ? 'text-error' : 'text-on-surface-variant',
      href: '/manager/reports',
    },
    {
      label: t('manager.occupancy'),
      value: `${stats.occupancyRatePct}%`,
      note: null,
      noteTone: '',
      href: '/manager/rooms',
      bar: stats.occupancyRatePct,
    },
    {
      label: `${t('manager.checkIns')} / ${t('manager.checkOuts')}`,
      value: `${stats.checkInsToday} / ${stats.checkOutsToday}`,
      note: t('manager.today.checkOutsNote'),
      noteTone: 'text-on-surface-variant',
      href: '/manager/bookings',
    },
    {
      label: t('manager.newBookings'),
      value: String(stats.newBookingsToday),
      note: `${t('manager.webBookings')} ${stats.webBookings} · ${t('manager.walkInBookings')} ${stats.walkInBookings}`,
      noteTone: 'text-on-surface-variant',
      href: '/manager/bookings',
    },
  ]

  return (
    <section aria-label={t('manager.today.title')} className="bg-surface-container-lowest rounded-2xl overflow-hidden grid grid-cols-2 lg:grid-cols-4">
      {figures.map((f, i) => (
        <Link
          key={f.label}
          href={f.href}
          className={`min-w-0 flex flex-col gap-1 p-4 sm:p-5 md:p-6 hover:bg-surface-container-low transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary ${
            i % 2 === 1 ? 'border-l border-surface-container' : ''
          } ${i >= 2 ? 'border-t lg:border-t-0 border-surface-container' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
        >
          <span className="text-[13px] font-medium text-on-surface-variant">{f.label}</span>
          <span className="font-display text-[22px] sm:text-[28px] leading-[1.15] text-primary tabular-nums [overflow-wrap:anywhere]">{f.value}</span>
          {f.bar != null && (
            <span className="mt-1 h-1.5 rounded-full bg-surface-container overflow-hidden" aria-hidden>
              <span className="block h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, f.bar))}%` }} />
            </span>
          )}
          {f.note && <span className={`text-[13px] ${f.noteTone}`}>{f.note}</span>}
        </Link>
      ))}
    </section>
  )
}
