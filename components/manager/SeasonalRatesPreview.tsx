import type { SeasonalRate } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface SeasonalRatesPreviewProps {
  rates: SeasonalRate[]
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatPricing(rate: SeasonalRate): string {
  if (rate.flat_price != null) return `${formatTHB(rate.flat_price)}/คืน`
  if (rate.price_multiplier != null) {
    const pct = (rate.price_multiplier * 100).toFixed(0)
    const sign = rate.price_multiplier >= 1 ? '+' : ''
    return `${sign}${pct}%`
  }
  return '—'
}

export function SeasonalRatesPreview({ rates }: SeasonalRatesPreviewProps) {
  if (rates.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-8 text-center">
        <MaterialIcon name="event" size={32} className="text-on-surface-variant mb-2" />
        <p className="text-body-md text-on-surface-variant">ยังไม่มีช่วงลดราคา</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <ul className="divide-y divide-outline-variant">
        {rates.map((rate) => (
          <li key={rate.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon name="event" size={16} className="text-secondary" />
                  <h4 className="text-body-md font-semibold text-primary">{rate.label}</h4>
                  <span className="text-caption text-on-surface-variant">
                    · {rate.room_type_name ?? 'ห้องทั่วไป'}
                  </span>
                </div>
                <p className="text-caption text-on-surface-variant">
                  {formatDate(rate.start_date)} – {formatDate(rate.end_date)}
                  {rate.min_nights_override != null && (
                    <span className="ml-2">ขั้นต่ำ {rate.min_nights_override} คืน</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <span className="font-display text-body-lg text-secondary">
                  {formatPricing(rate)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
