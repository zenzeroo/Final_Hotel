'use client'

import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import type { ChannelSlice } from '@/lib/data/types'
import { EmptyState } from '@/components/feedback/EmptyState'

ChartJS.register(ArcElement, Tooltip)

interface ChannelsDonutChartProps {
  channels: ChannelSlice[]
}

export function ChannelsDonutChart({ channels }: ChannelsDonutChartProps) {
  // Empty branch — guard against silent blank donut on no-bookings DB.
  // getReportsData returns channels=[] when zero bookings in the window.
  if (channels.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-4">ช่องทางการจอง</h3>
        <EmptyState
          icon="donut_large"
          title="ยังไม่มีข้อมูลช่องทาง"
          description="ต้องมีข้อมูลการจองก่อนจะแสดงสัดส่วนช่องทางการจองได้"
        />
      </div>
    )
  }

  const chartData = {
    labels: channels.map((c) => c.label),
    datasets: [
      {
        data: channels.map((c) => c.percent),
        backgroundColor: channels.map((c) => c.color),
        borderWidth: 2,
        borderColor: '#faf9f6',
      },
    ],
  }

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` },
      },
    },
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">ช่องทางการจอง</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 shrink-0">
          <Doughnut data={chartData} options={options} />
        </div>
        <ul className="flex flex-col gap-2 text-body-md">
          {channels.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className="text-on-surface">{c.label}</span>
              <span className="text-on-surface-variant ml-auto">{c.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
