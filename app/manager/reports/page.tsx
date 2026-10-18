import { getReportsData } from '@/lib/data/manager'
import { defaultReportRange, parseReportRange } from '@/lib/dates'
import type { ReportMetric } from '@/lib/data/types'
import { ReportTrendChart } from '@/components/manager/ReportTrendChart'
import { RankedBarChart } from '@/components/manager/RankedBarChart'
import { ReportsDateRange } from '@/components/manager/ReportsDateRange'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

const METRICS: readonly ReportMetric[] = ['revenue', 'bookings', 'adr', 'occupancy', 'cancellations']
const parseMetric = (v: string | undefined): ReportMetric =>
  METRICS.includes(v as ReportMetric) ? (v as ReportMetric) : 'revenue'

// Range bounds are calendar dates — format at UTC so the server timezone
// can never shift them by a day.
const formatDay = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    calendar: 'gregory',
  }).format(new Date(`${iso}T00:00:00Z`))

export default async function ManagerReportsPage(props: PageProps<'/manager/reports'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const sp = await props.searchParams
  const range = parseReportRange(param(sp.from), param(sp.to))
  const data = await getReportsData(range)
  const def = defaultReportRange()
  const isDefault = range.from === def.from && range.to === def.to

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('manager.reportsPage.heading')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {formatDay(range.from, locale)} – {formatDay(range.to, locale)} ·{' '}
            {t('manager.reportsPage.rangeDays', { count: range.days })}
          </p>
        </div>
        <ReportsDateRange from={range.from} to={range.to} isDefault={isDefault} />
      </header>

      <section className="mb-8">
        <ReportTrendChart
          data={data.trend}
          summary={data.trendSummary}
          hasOccupancyLastYear={data.hasOccupancyLastYear}
          granularity={range.granularity}
          days={range.days}
          initialMetric={parseMetric(param(sp.metric))}
          cancellation={{
            ratePct: data.cancellationRatePct,
            trendPct: data.cancellationTrendPct,
            totalBookings: data.totalBookings,
          }}
        />
      </section>

      {/* Two columns — room names need the width to stay readable. */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RankedBarChart
          title={t('manager.reportsPage.mostBooked')}
          labels={data.mostBookedRooms.map((r) => r.name)}
          values={data.mostBookedRooms.map((r) => r.count)}
          format="count"
          label={t('manager.reportsPage.bookingsLabel')}
        />
        <RankedBarChart
          title={t('manager.reportsPage.topRevenue')}
          labels={data.highestRevenueRoomTypes.map((r) => r.name)}
          values={data.highestRevenueRoomTypes.map((r) => r.revenue)}
          format="thb"
          label={t('manager.reportsPage.revenueLabel')}
        />
      </section>
    </div>
  )
}
