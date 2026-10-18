'use client'

/**
 * Shared vertical bar chart — every chart in the app renders through this so
 * they share one look (colours, bar shape, tooltip, grid, height).
 *
 * Formatters live here (not in props) so server pages never pass functions
 * across the RSC boundary.
 */
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
import { chartColors, chartFont } from '@/lib/chart-theme'
import { formatTHB } from '@/lib/pricing'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export type BarFormat = 'thb' | 'count' | 'percent'

export interface BarDataset {
  label: string
  values: number[]
  /** One colour for the series, or one per bar. Default: primary. */
  color?: string | string[]
}

interface BarChartProps {
  labels: string[]
  datasets: BarDataset[]
  format: BarFormat
  /** Fixed y-axis maximum (e.g. 100 for percentages). */
  yMax?: number
  /** Colour the last bar of a single-series chart with the accent (e.g. "today"). */
  highlightLast?: boolean
  /** Unit suffix for `count` values, e.g. "การจอง". */
  countUnit?: string
  /** Full labels for tooltip titles when the axis labels are shortened/blank. */
  tooltipLabels?: string[]
  /** BCP-47 locale for THB formatting. */
  numberLocale?: string
  /** Tailwind height class for the canvas box. */
  height?: string
  ariaLabel: string
}

const MAX_TICK_CHARS = 12
/** Money axes never step below ฿1,000 (otherwise an empty range shows ฿0.1 ticks). */
const MIN_THB_STEP = 1000

/** Smallest 1/2/5 × 10ⁿ that is ≥ `raw`, but never below `min`. */
function niceStep(raw: number, min: number): number {
  if (raw <= min) return min
  const pow = 10 ** Math.floor(Math.log10(raw))
  const unit = [1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10
  return unit * pow
}

export function BarChart({
  labels,
  datasets,
  format,
  yMax,
  highlightLast = false,
  countUnit = '',
  tooltipLabels,
  numberLocale = 'th-TH',
  height = 'h-64',
  ariaLabel,
}: BarChartProps) {
  const fmt = (v: number) =>
    format === 'thb' ? formatTHB(v, numberLocale) : format === 'percent' ? `${v}%` : `${v}${countUnit ? ` ${countUnit}` : ''}`

  const chartData = {
    labels,
    datasets: datasets.map((d) => {
      const base = d.color ?? chartColors.primary
      const backgroundColor =
        highlightLast && typeof base === 'string'
          ? d.values.map((_, i) => (i === d.values.length - 1 ? chartColors.secondary : base))
          : base
      return {
        label: d.label,
        data: d.values,
        backgroundColor,
        borderRadius: 4,
        maxBarThickness: 28,
      }
    }),
  }

  const dataMax = Math.max(0, ...datasets.flatMap((d) => d.values))
  const thbStep = format === 'thb' ? niceStep(dataMax / 5, MIN_THB_STEP) : undefined

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'top',
        align: 'end',
        labels: { color: chartColors.textMuted, font: chartFont, boxWidth: 12 },
      },
      tooltip: {
        backgroundColor: chartColors.primary,
        titleColor: chartColors.background,
        bodyColor: chartColors.background,
        padding: 10,
        callbacks: {
          // Full (untruncated) label in the tooltip title.
          title: (items) => (items[0] ? (tooltipLabels ?? labels)[items[0].dataIndex] ?? '' : ''),
          label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y as number)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: chartColors.textMuted,
          font: chartFont,
          autoSkip: false,
          maxRotation: 0,
          callback: (_v, i) => {
            const l = labels[i] ?? ''
            return l.length > MAX_TICK_CHARS ? `${l.slice(0, MAX_TICK_CHARS)}…` : l
          },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        // Money axes always reach at least ฿5,000 (0, 1,000 … 5,000 when revenue is low).
        suggestedMax: thbStep ? Math.max(MIN_THB_STEP * 5, thbStep) : undefined,
        ticks: { color: chartColors.textMuted, font: chartFont, stepSize: thbStep, precision: format === 'count' ? 0 : undefined, callback: (v) => fmt(Number(v)) },
        grid: { color: chartColors.outlineVariant },
      },
    },
  }

  return (
    <div className={height} role="img" aria-label={ariaLabel}>
      <Bar data={chartData} options={options} />
    </div>
  )
}
