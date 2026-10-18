import type { SeasonalRate } from '@/lib/data/types'
import { pickSeasonalRate } from '@/lib/pricing/seasons'

/** ×1.5 → "+50%", ×0.8 → "−20%" — the change against base price, not the multiplier itself. */
export function formatMultiplier(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100)
  if (pct === 0) return '±0%'
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`
}

export type RateState = 'current' | 'upcoming' | 'expired' | 'inactive'

/** `today` is a Bangkok YYYY-MM-DD; rate dates are inclusive on both ends. */
export function rateState(rate: SeasonalRate, today: string): RateState {
  if (!rate.is_active) return 'inactive'
  if (rate.end_date < today) return 'expired'
  if (rate.start_date > today) return 'upcoming'
  return 'current'
}

/** Tonight's nightly price for a room type — same rule as `quoteStay` in lib/pricing/seasons.ts. */
export function todayPrice(
  basePrice: number,
  rates: SeasonalRate[],
  roomTypeId: string,
  today: string,
): { price: number; label: string | null } {
  const rate = pickSeasonalRate(
    rates.filter((r) => r.room_type_id === roomTypeId),
    today,
  )
  if (!rate) return { price: basePrice, label: null }
  if (rate.flat_price != null) return { price: Number(rate.flat_price), label: rate.label }
  if (rate.price_multiplier != null) {
    return { price: Math.round(basePrice * Number(rate.price_multiplier)), label: rate.label }
  }
  return { price: basePrice, label: null }
}
