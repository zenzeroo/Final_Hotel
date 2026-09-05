'use client'

import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { chartColors, chartFont } from '@/lib/chart-theme'
import { EmptyState } from '@/components/feedback/EmptyState'

export type BarFormat = 'thb' | 'count' | 'percent'

interface HorizontalBarChartProps {
  title: string
  labels: string[]
  values: number[]
  format: BarFormat
  label: string
  emptyDescription?: string
}

// Client-side formatter dict — keep inside the client component so the
// server never has to pass a function across the RSC boundary.
const FORMATTERS: Record<BarFormat, (v: number) => string> = {
  thb: (v) => `฿${new Intl.NumberFormat('th-TH').format(v)}`,
  count: (v) => `${v} การจอง`,
  percent: (v) => `${v}%`,
}

export function HorizontalBarChart({
  title,
  labels,
  values,
  format,
  label,
  emptyDescription,
}: HorizontalBarChartProps) {
  // Empty branch — guard against silent blank chart on no-bookings DB.
  // getReportsData returns mostBookedRooms=[] / highestRevenueRoomTypes=[]
  // when zero bookings in the analysis window.
  if (labels.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{title}</h3>
        <EmptyState
          icon="bar_chart"
          title="ยังไม่มีข้อมูล"
          description={emptyDescription ?? 'ต้องมีข้อมูลการจองก่อนจะแสดงกราฟนี้ได้'}
        />
      </div>
    )
  }

  const fmt = FORMATTERS[format]

  const chartData = {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: chartColors.primary,
        borderRadius: 4,
        barThickness: 18,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartColors.primary,
        callbacks: { label: (ctx) => `${label}: ${fmt(ctx.parsed.x as number)}` },
      },
    },
    scales: {
      x: {
        ticks: {
          color: chartColors.textMuted,
          font: chartFont,
          callback: (v) => fmt(Number(v)),
        },
        grid: { color: chartColors.outlineVariant },
      },
      y: {
        ticks: { color: chartColors.onSurface, font: chartFont },
        grid: { display: false },
      },
    },
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{title}</h3>
      <div className="h-48">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
