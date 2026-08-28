'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'
import type { OccupancyMonthPoint } from '@/lib/data/types'
import { chartColors, chartFont } from '@/lib/chart-theme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface OccupancyBarChartProps {
  data: OccupancyMonthPoint[]
}

export function OccupancyBarChart({ data }: OccupancyBarChartProps) {
  const labels = data.map((d) => d.month)
  const last = data.map((d) => d.last)
  const current = data.map((d) => d.current)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'ปีก่อน',
        data: last,
        backgroundColor: chartColors.outlineVariant,
        borderRadius: 4,
        barThickness: 18,
      },
      {
        label: 'ปีนี้',
        data: current,
        backgroundColor: chartColors.secondary,
        borderRadius: 4,
        barThickness: 18,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { color: chartColors.textMuted, font: chartFont, boxWidth: 12 },
      },
      tooltip: {
        backgroundColor: chartColors.primary,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
      },
    },
    scales: {
      x: {
        ticks: { color: chartColors.textMuted, font: chartFont },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: chartColors.textMuted,
          font: chartFont,
          callback: (v) => `${v}%`,
        },
        grid: { color: chartColors.outlineVariant },
      },
    },
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">อัตราการเข้าพักเทียบปีก่อน</h3>
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
