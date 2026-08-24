/**
 * Pricing calculations for bookings.
 * All amounts in THB.
 *
 * Phase 8: optional `quote` field accepts a pre-computed nightly breakdown
 * from lib/pricing/seasons.ts. When provided, `baseSubtotal` comes from
 * the quote (which respects seasonal_rates); when omitted, falls back to
 * `nights × basePrice` for backward compatibility with admin previews.
 */

import { differenceInCalendarDays, parseISO, isValid } from 'date-fns'
import type { QuoteResult } from './pricing/seasons'

export interface PriceInput {
  basePrice: number         // THB per night
  checkIn: string          // ISO date YYYY-MM-DD
  checkOut: string         // ISO date YYYY-MM-DD
  guests?: number          // for future guest-based pricing
  promotion?: {
    code: string
    discountType: 'percent' | 'flat'
    discountValue: number
    minNights?: number
  } | null
  /**
   * Optional Phase 8 nightly quote. When provided, replaces the
   * `nights × basePrice` baseSubtotal computation.
   */
  quote?: QuoteResult
}

export interface PriceBreakdown {
  nights: number
  baseSubtotal: number
  discountTotal: number
  taxTotal: number
  feeTotal: number
  total: number
  currency: 'THB'
}

const TAX_RATE = 0.07
const RESORT_FEE_PER_NIGHT = 150

/**
 * Calculate the number of nights between check-in and check-out.
 * Returns 0 for invalid dates.
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const ci = parseISO(checkIn)
  const co = parseISO(checkOut)
  if (!isValid(ci) || !isValid(co)) return 0
  const nights = differenceInCalendarDays(co, ci)
  return Math.max(0, nights)
}

/**
 * Apply promotion discount to subtotal.
 * Returns the discount amount in THB.
 */
export function applyPromotion(
  subtotal: number,
  nights: number,
  promotion: PriceInput['promotion']
): number {
  if (!promotion) return 0
  if (promotion.minNights && nights < promotion.minNights) return 0

  if (promotion.discountType === 'percent') {
    return Math.round((subtotal * promotion.discountValue) / 100)
  }
  if (promotion.discountType === 'flat') {
    return Math.min(subtotal, promotion.discountValue)
  }
  return 0
}

/**
 * Calculate full price breakdown for a booking.
 *
 * If `input.quote` is supplied, `baseSubtotal` and `nights` are taken
 * from the seasonal-aware quote. Otherwise the legacy formula applies.
 */
export function calculatePrice(input: PriceInput): PriceBreakdown {
  const nights = input.quote ? input.quote.nights : calculateNights(input.checkIn, input.checkOut)

  // Base: prefer quote (Phase 8) over flat nights × basePrice (legacy).
  const baseSubtotal = input.quote
    ? input.quote.baseSubtotal
    : nights * input.basePrice

  // Discount (from promo)
  const discountTotal = applyPromotion(baseSubtotal, nights, input.promotion ?? null)

  // Resort fee: 150 per night
  const feeTotal = nights * RESORT_FEE_PER_NIGHT

  // Tax: 7% of (subtotal - discount)
  const taxableAmount = baseSubtotal - discountTotal
  const taxTotal = Math.round(taxableAmount * TAX_RATE)

  const total = baseSubtotal - discountTotal + taxTotal + feeTotal

  return {
    nights,
    baseSubtotal,
    discountTotal,
    taxTotal,
    feeTotal,
    total,
    currency: 'THB',
  }
}

/**
 * Format THB amount for display.
 * Example: 12500 → "฿12,500"
 */
export function formatTHB(amount: number): string {
  return `฿${new Intl.NumberFormat('th-TH').format(amount)}`
}

/**
 * Generate a human-readable booking code (display only).
 * Format: ZZR-XXXXX (5 random alphanumeric chars)
 */
export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1
  let code = 'ZZR-'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
