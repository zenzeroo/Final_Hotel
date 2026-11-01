import Link from 'next/link'
import type { ReportTrendPoint } from '@/lib/data/types'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { BarChart } from './BarChart'

/**
 * Last 7 days: revenue and occupancy as two small bar charts (BarChart has
 * no line series). The full analysis lives on /manager/reports.
 */
export function WeekTrend({
  trend,
  reportHref,
  locale,
}: {
  trend: ReportTrendPoint[]
  reportHref: string
  locale: Locale
}) {
  const t = getT(locale)
  const labels = trend.map((d) => d.label)
  return (
    <section aria-labelledby="week-trend" className="bg-surface-container-lowest rounded-2xl p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <h2 id="week-trend" className="font-display text-xl text-primary">{t('manager.week.title')}</h2>
        <Link
          href={reportHref}
          className="text-[14px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {t('manager.week.fullReport')}
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-[13px] font-medium text-on-surface-variant mb-2">{t('manager.week.revenue')}</p>
          <BarChart
            labels={labels}
            datasets={[{ label: t('manager.week.revenue'), values: trend.map((d) => d.revenue) }]}
            format="thb"
            highlightLast
            numberLocale={LOCALE_BCP47[locale]}
            height="h-44"
            ariaLabel={t('manager.week.revenue')}
          />
        </div>
        <div>
          <p className="text-[13px] font-medium text-on-surface-variant mb-2">{t('manager.week.occupancy')}</p>
          <BarChart
            labels={labels}
            datasets={[{ label: t('manager.week.occupancy'), values: trend.map((d) => d.occupancy) }]}
            format="percent"
            yMax={100}
            highlightLast
            numberLocale={LOCALE_BCP47[locale]}
            height="h-44"
            ariaLabel={t('manager.week.occupancy')}
          />
        </div>
      </div>
    </section>
  )
}
