/**
 * Pure seasonal-rates pricing engine.
 * No I/O — callers are responsible for fetching rates.
 *
 * Algorithm (Phase 8):
 *   - Per-night prorate: each night independently picks the highest-priority
 *     active rate whose [start_date, end_date] (inclusive on both ends)
 *     contains the night. Tie-break: priority desc, id desc.
 *   - flat_price if set, else round(basePrice * price_multiplier), else basePrice.
 *   - Aggregates per-rate usage for UI.
 *   - min_nights_override: enforced separately via violatesMinNights.
 *
 * Date semantics:
 *   - All dates are ISO YYYY-MM-DD, parsed by date-fns/parseISO.
 *   - checkOut is EXCLUSIVE (guest leaves morning of checkOut; last billed
 *     night is checkOut - 1).
 *   - rate.end_date is INCLUSIVE (industry convention).
 */

import { parseISO, addDays, isValid, format } from 'date-fns'
import type { SeasonalRate } from '@/lib/data/types'

export interface QuoteInput {
  roomTypeId: string
  basePrice: number
  checkIn: string // YYYY-MM-DD
  checkOut: string // YYYY-MM-DD (exclusive)
  rates: SeasonalRate[]
}

export interface NightlyBreakdown {
  date: string // YYYY-MM-DD
  rate: number
  rateId: string | null
  rateLabel: string | null
}

export interface AppliedRate {
  id: string
  label: string
  nights: number
  /** Mirrors the source rate's min_nights_override for UI display (null when unset). */
  minNightsOverride: number | null
}

export interface QuoteResult {
  nights: number
  nightlyBreakdown: NightlyBreakdown[]
  appliedRates: AppliedRate[]
  baseSubtotal: number
}

/**
 * Pick the highest-priority active rate whose [start_date, end_date]
 * (inclusive) contains `date`. Tie-break: priority desc, id desc.
 * Returns null when no rate applies — base_price should be used.
 */
export function pickSeasonalRate(
  rates: SeasonalRate[],
  date: string,
): SeasonalRate | null {
  const matching = rates.filter((r) => {
    if (!r.is_active) return false
    return date >= r.start_date && date <= r.end_date
  })
  if (matching.length === 0) return null
  matching.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return b.id.localeCompare(a.id)
  })
  return matching[0]
}

/**
 * Build a per-night breakdown for [checkIn, checkOut). Throws when
 * checkIn >= checkOut or either is unparseable.
 */
export function quoteStay(input: QuoteInput): QuoteResult {
  const ci = parseISO(input.checkIn)
  const co = parseISO(input.checkOut)
  if (!isValid(ci) || !isValid(co)) {
    throw new Error('quoteStay: invalid date — checkIn=' + input.checkIn + ' checkOut=' + input.checkOut)
  }
  if (input.checkIn >= input.checkOut) {
    throw new Error('quoteStay: checkIn (' + input.checkIn + ') must be before checkOut (' + input.checkOut + ')')
  }

  const nights = Math.round((co.getTime() - ci.getTime()) / (24 * 3600 * 1000))
  const breakdown: NightlyBreakdown[] = []
  const counts = new Map<string, { id: string; label: string; nights: number }>()

  for (let i = 0; i < nights; i++) {
    const date = format(addDays(ci, i), 'yyyy-MM-dd')
    const matched = pickSeasonalRate(input.rates, date)
    let rate: number
    let rateId: string | null
    let rateLabel: string | null

    if (matched) {
      if (matched.flat_price != null) {
        rate = matched.flat_price
      } else if (matched.price_multiplier != null) {
        rate = Math.round(input.basePrice * matched.price_multiplier)
      } else {
        // Schema enforces XOR; defensive fall-through.
        rate = input.basePrice
      }
      rateId = matched.id
      rateLabel = matched.label

      const existing = counts.get(matched.id)
      if (existing) existing.nights += 1
      else counts.set(matched.id, { id: matched.id, label: matched.label, nights: 1 })
    } else {
      rate = input.basePrice
      rateId = null
      rateLabel = null
    }

    breakdown.push({ date, rate, rateId, rateLabel })
  }

  const baseSubtotal = breakdown.reduce((sum, b) => sum + b.rate, 0)
  const appliedRates = [...counts.values()]
    .map((c) => {
      const source = input.rates.find((r) => r.id === c.id)
      return {
        id: c.id,
        label: c.label,
        nights: c.nights,
        minNightsOverride: source?.min_nights_override ?? null,
      }
    })
    .sort((a, b) => {
      if (a.nights !== b.nights) return b.nights - a.nights
      return a.id.localeCompare(b.id)
    })

  return { nights, nightlyBreakdown: breakdown, appliedRates, baseSubtotal }
}

/**
 * True if any applied rate's min_nights_override is set AND exceeds
 * the booking span. Returns false when no rate applies or all overrides
 * are null / 0.
 */
export function violatesMinNights(
  q: QuoteResult,
  rates: SeasonalRate[],
): boolean {
  if (q.nights === 0) return false
  const rateById = new Map(rates.map((r) => [r.id, r]))
  for (const applied of q.appliedRates) {
    const rate = rateById.get(applied.id)
    if (!rate) continue
    if (rate.min_nights_override != null && rate.min_nights_override > q.nights) {
      return true
    }
  }
  return false
}
