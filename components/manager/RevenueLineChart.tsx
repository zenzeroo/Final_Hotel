'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ScriptableContext,
} from 'chart.js'
import type { RevenueBarPoint } from '@/lib/data/types'
import { chartColors, chartFont } from '@/lib/chart-theme'
import { formatTHB } from '@/lib/pricing'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface RevenueLineChartProps {
  data: RevenueBarPoint[]
  total: number
  trendPct: number
}

export function RevenueLineChart({ data, total, trendPct }: RevenueLineChartProps) {
  const labels = data.map((d) => d.label ?? d.date.slice(5))
  const values = data.map((d) => d.revenue)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'รายได้',
        data: values,
        borderColor: chartColors.primary,
        borderWidth: 2,
        pointBackgroundColor: chartColors.primary,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return chartColors.primaryContainer + '33'
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(8, 39, 23, 0.45)')
          gradient.addColorStop(1, 'rgba(8, 39, 23, 0)')
          return gradient
        },
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        backgroundColor: chartColors.primary,
        titleColor: '#faf9f6',
        bodyColor: '#faf9f6',
        padding: 10,
        callbacks: {
          label: (ctx) => `รายได้: ${formatTHB(ctx.parsed.y as number)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: chartColors.textMuted, font: chartFont },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: chartColors.textMuted,
          font: chartFont,
          callback: (v) => formatTHB(Number(v)),
        },
        grid: { color: chartColors.outlineVariant },
      },
    },
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
            รายได้รวม (7 วัน)
          </p>
          <p className="font-display text-display-lg-mobile text-primary">{formatTHB(total)}</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container text-caption">
          +{trendPct.toFixed(1)}%
        </span>
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
