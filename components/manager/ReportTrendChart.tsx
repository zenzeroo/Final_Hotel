'use client'

/**
 * Reports — main chart with a metric dropdown (revenue, bookings, ADR,
 * occupancy, cancellations) over the selected range, per day or per month.
 * All series come from the server in one payload; switching is client-only
 * and mirrored to `?metric=` via `history.replaceState` (no server refetch).
 */
import { useState } from 'react'
import type { ReportMetric, ReportRange, ReportTrendPoint } from '@/lib/data/types'
import { chartColors } from '@/lib/chart-theme'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { BarChart, type BarDataset, type BarFormat } from './BarChart'
import { CancellationStatCard } from './CancellationStatCard'
import { useLocale } from '@/lib/i18n/useT'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/useT'

interface ReportTrendChartProps {
  data: ReportTrendPoint[]
  summary: Record<ReportMetric, number>
  hasOccupancyLastYear: boolean
  granularity: ReportRange['granularity']
  /** Length of the selected range, for the header label. */
  days: number
  initialMetric: ReportMetric
  /** Cancellation-rate card data — the card shows only for the cancellations metric. */
  cancellation: { ratePct: number; trendPct: number; totalBookings: number }
}

/** Dictionary keys (manager.reportsPage.*). */
interface MetricDef {
  label: string
  /** Header caption key; takes a `{days}` param. */
  summaryLabel: string
  format: BarFormat
  countUnit?: string
  note?: string
}

const REPORT_METRICS: Record<ReportMetric, MetricDef> = {
  revenue: { label: 'manager.reportsPage.metricRevenue', summaryLabel: 'manager.reportsPage.metricRevenueSummary', format: 'thb' },
  bookings: { label: 'manager.reportsPage.metricBookings', summaryLabel: 'manager.reportsPage.metricBookingsSummary', format: 'count', countUnit: 'manager.reportsPage.bookingsUnit', note: 'manager.reportsPage.metricBookingsNote' },
  adr: { label: 'manager.reportsPage.metricAdr', summaryLabel: 'manager.reportsPage.metricAdrSummary', format: 'thb', note: 'manager.reportsPage.metricAdrNote' },
  occupancy: { label: 'manager.reportsPage.metricOccupancy', summaryLabel: 'manager.reportsPage.metricOccupancySummary', format: 'percent', note: 'manager.reportsPage.metricOccupancyNote' },
  cancellations: { label: 'manager.reportsPage.metricCancellations', summaryLabel: 'manager.reportsPage.metricCancellationsSummary', format: 'count', countUnit: 'manager.reportsPage.itemsUnit', note: 'manager.reportsPage.metricCancellationsNote' },
}

const METRIC_KEYS = Object.keys(REPORT_METRICS) as ReportMetric[]

function formatSummary(
  metric: ReportMetric,
  value: number,
  t: (key: string) => string,
  locale: Locale,
): string {
  const def = REPORT_METRICS[metric]
  if (def.format === 'thb') return formatTHB(value)
  if (def.format === 'percent') return `${value}%`
  return `${value.toLocaleString(LOCALE_BCP47[locale])} ${def.countUnit ? t(def.countUnit) : ''}`.trim()
}

export function ReportTrendChart({
  data,
  summary,
  hasOccupancyLastYear,
  granularity,
  days,
  initialMetric,
  cancellation,
}: ReportTrendChartProps) {
  const t = useT()
  const locale = useLocale()
  const [metric, setMetric] = useState<ReportMetric>(initialMetric)
  const def = REPORT_METRICS[metric]

  function handleChange(next: ReportMetric) {
    setMetric(next)
    const url = new URL(window.location.href)
    if (next === 'revenue') url.searchParams.delete('metric')
    else url.searchParams.set('metric', next)
    window.history.replaceState(null, '', url)
  }

  const datasets: BarDataset[] =
    metric === 'occupancy'
      ? [
          ...(hasOccupancyLastYear
            ? [{ label: t('manager.reportsPage.lastYear'), values: data.map((d) => d.occupancyLast ?? 0), color: chartColors.outlineVariant }]
            : []),
          { label: t('manager.reportsPage.selectedRange'), values: data.map((d) => d.occupancy), color: chartColors.secondary },
        ]
      : [{ label: t(def.label), values: data.map((d) => d[metric]) }]

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {t(def.summaryLabel, { days })}
            </p>
            <p className="font-display text-display-lg-mobile text-primary">{formatSummary(metric, summary[metric], t, locale)}</p>
            {def.note && <p className="text-caption text-on-surface-variant mt-1">{t(def.note)}</p>}
          </div>
          <label className="relative inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full pl-3 pr-3 py-1.5 hover:border-secondary focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-colors">
            <MaterialIcon name="insights" size={16} className="text-on-surface-variant shrink-0" />
            <span className="sr-only">{t('manager.reportsPage.pickMetric')}</span>
            <select
              value={metric}
              onChange={(e) => handleChange(e.target.value as ReportMetric)}
              className="bg-transparent text-body-md text-on-surface focus:outline-none cursor-pointer pr-1"
            >
              {METRIC_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(REPORT_METRICS[k].label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <BarChart
          labels={data.map((d) => d.label)}
          datasets={datasets}
          format={def.format}
          countUnit={def.countUnit ? t(def.countUnit) : undefined}
          yMax={metric === 'occupancy' ? 100 : undefined}
          ariaLabel={t('manager.reportsPage.chartAria', {
            label: t(def.label),
            days,
            granularity: t(granularity === 'day' ? 'manager.reportsPage.daily' : 'manager.reportsPage.monthly'),
          })}
        />
      </div>
      {metric === 'cancellations' && (
        <div className="max-w-sm">
          <CancellationStatCard {...cancellation} />
        </div>
      )}
    </div>
  )
}
