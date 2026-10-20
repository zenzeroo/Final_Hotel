'use client'

/**
 * Manager dashboard revenue bars. Phase 54: the 7d/30d toggle switches
 * real data (it previously rendered the same 7 points for both), labels
 * and headings are localized, and day names come from `Intl` instead of a
 * hardcoded English list.
 */
import { useState } from 'react'
import type { RevenueBarPoint } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { useLocale, useT } from '@/lib/i18n/useT'
import { BarChart } from './BarChart'

interface RevenueBarChartProps {
  data7d: RevenueBarPoint[]
  data30d: RevenueBarPoint[]
  className?: string
}

export function RevenueBarChart({ data7d, data30d, className = '' }: RevenueBarChartProps) {
  const t = useT()
  const bcp = useLocale() === 'en' ? 'en-GB' : 'th-TH'
  const [range, setRange] = useState<'7d' | '30d'>('7d')
  const points = range === '7d' ? data7d : data30d
  const isWide = range === '30d'
  const total = points.reduce((s, p) => s + p.revenue, 0)

  // `date` is a calendar date — format at UTC midnight so the label never
  // shifts with the browser's timezone.
  const dayLabel = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`)
    return isWide
      ? new Intl.DateTimeFormat(bcp, { day: 'numeric', timeZone: 'UTC' }).format(d)
      : new Intl.DateTimeFormat(bcp, { weekday: 'short', timeZone: 'UTC' }).format(d)
  }
  const fullDate = (date: string) => {
    const [, m, d] = date.split('-')
    return `${d}/${m}`
  }

  return (
    <div className={`bg-surface-container-lowest rounded-lg shadow-level-1 p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">
            {t(isWide ? 'manager.revenueChart.title30d' : 'manager.revenueChart.title7d')}
          </h3>
          <p className="text-caption text-on-surface-variant mt-1">
            {t('manager.revenueChart.subtitle')} · {t('manager.revenueChart.total', { amount: formatTHB(total, bcp) })}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-outline-variant overflow-hidden text-caption">
          {(['7d', '30d'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRange(opt)}
              aria-pressed={range === opt}
              className={`px-4 py-1.5 uppercase tracking-wider transition-colors duration-200 ${
                range === opt
                  ? 'bg-primary text-secondary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <BarChart
        labels={points.map((p, idx) => {
          const isToday = idx === points.length - 1
          // 30d: label every 5th day + today so labels don't collide.
          const showLabel = !isWide || isToday || (points.length - 1 - idx) % 5 === 0
          if (!showLabel) return ''
          return isToday ? t('manager.revenueChart.today') : dayLabel(p.date)
        })}
        tooltipLabels={points.map((p) => fullDate(p.date))}
        datasets={[{ label: t('manager.revenueChart.series'), values: points.map((p) => p.revenue) }]}
        format="thb"
        numberLocale={bcp}
        highlightLast
        ariaLabel={t(isWide ? 'manager.revenueChart.title30d' : 'manager.revenueChart.title7d')}
      />
    </div>
  )
}
