'use server'

import { z } from 'zod'
import { getActiveSeasonalRatesForRange } from '@/lib/data/manager'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import type { SeasonalRate } from '@/lib/data/types'
import type { AppliedRate } from '@/lib/pricing/seasons'

const quoteRequestSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Cap nightly rate to keep quote arithmetic safe from overflow / abuse.
  // 1,000,000 THB/night covers even ultra-luxury suites with room to spare.
  basePrice: z.number().positive().max(1_000_000),
})

export interface SeasonalRatesResponse {
  ok: boolean
  error?: string
  rates?: SeasonalRate[]
  quote?: {
    nights: number
    baseSubtotal: number
    nightlyBreakdown: Array<{ date: string; rate: number; rateId: string | null; rateLabel: string | null }>
    appliedRates: AppliedRate[]
  }
  violatesMinNights?: boolean
}

/**
 * Public read of seasonal rates + a computed nightly quote for a room type.
 * Used by the client-side BookingWidget to refresh the price estimate
 * whenever the user picks new dates (before they submit the booking form).
 *
 * No auth required — seasonal_rates has a public read policy for active rows.
 */
export async function getSeasonalRatesAction(input: {
  roomTypeId: string
  checkIn: string
  checkOut: string
  basePrice: number
}): Promise<SeasonalRatesResponse> {
  const parsed = quoteRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const { roomTypeId, checkIn, checkOut, basePrice } = parsed.data
  if (checkIn >= checkOut) {
    return { ok: false, error: 'วันที่เช็คเอาท์ต้องมาหลังวันเช็คอิน' }
  }

  try {
    const rates = await getActiveSeasonalRatesForRange({ roomTypeId, checkIn, checkOut })
    const quote = quoteStay({ roomTypeId, basePrice, checkIn, checkOut, rates })
    const violations = violatesMinNights(quote, rates)

    return {
      ok: true,
      rates,
      quote: {
        nights: quote.nights,
        baseSubtotal: quote.baseSubtotal,
        nightlyBreakdown: quote.nightlyBreakdown,
        appliedRates: quote.appliedRates,
      },
      violatesMinNights: violations,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ไม่สามารถคำนวณราคาได้',
    }
  }
}