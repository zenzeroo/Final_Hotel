'use client'

import { useState } from 'react'
import type { RevenueBarPoint } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'

interface RevenueBarChartProps {
  data: RevenueBarPoint[]
  className?: string
}

export function RevenueBarChart({ data, className = '' }: RevenueBarChartProps) {
  const [range, setRange] = useState<'7d' | '30d'>('7d')
  const points = range === '7d' ? data : data
  const max = Math.max(...points.map((p) => p.revenue), 1)

  return (
    <div className={`bg-surface-container-lowest rounded-lg shadow-level-1 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">Revenue (7 days)</h3>
          <p className="text-caption text-on-surface-variant mt-1">
            Daily revenue · highest bar = today
          </p>
        </div>
        <div className="inline-flex rounded-full border border-outline-variant overflow-hidden text-caption">
          {(['7d', '30d'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRange(opt)}
              className={`px-4 py-1.5 uppercase tracking-wider ${
                range === opt
                  ? 'bg-primary text-secondary'
                  : 'bg-surface-container-lowest text-on-surface-variant'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3 h-56">
        {points.map((p, idx) => {
          const isToday = idx === points.length - 1
          const heightPct = (p.revenue / max) * 100
          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-caption text-on-surface-variant">
                {formatTHB(p.revenue)}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    isToday ? 'bg-secondary' : 'bg-primary'
                  }`}
                  style={{ height: `${heightPct}%`, minHeight: '6px' }}
                  aria-label={`${p.label}: ${formatTHB(p.revenue)}`}
                />
              </div>
              <span
                className={`text-caption uppercase tracking-wider ${
                  isToday ? 'text-primary font-semibold' : 'text-on-surface-variant'
                }`}
              >
                {p.label ?? p.date.slice(8, 10)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
