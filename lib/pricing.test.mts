/**
 * Unit tests for the booking price breakdown.
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateNights, applyPromotion, calculatePrice } from './pricing'

test('calculateNights counts calendar nights and floors at 0', () => {
  assert.equal(calculateNights('2026-10-24', '2026-10-27'), 3)
  assert.equal(calculateNights('2026-10-27', '2026-10-24'), 0)
  assert.equal(calculateNights('nope', '2026-10-24'), 0)
})

test('calculatePrice: nights × base + 150/night fee + 7% tax', () => {
  const p = calculatePrice({ basePrice: 1000, checkIn: '2026-10-24', checkOut: '2026-10-26' })
  assert.deepEqual(p, {
    nights: 2,
    baseSubtotal: 2000,
    discountTotal: 0,
    taxTotal: 140,
    feeTotal: 300,
    total: 2440,
    currency: 'THB',
  })
})

test('calculatePrice: tax is on the discounted subtotal and settings override defaults', () => {
  const p = calculatePrice(
    {
      basePrice: 1000,
      checkIn: '2026-10-24',
      checkOut: '2026-10-26',
      promotion: { code: 'X', discountType: 'flat', discountValue: 500 },
    },
    { taxRate: 0.1, resortFeePerNight: 0 },
  )
  assert.equal(p.discountTotal, 500)
  assert.equal(p.taxTotal, 150)
  assert.equal(p.total, 1650)
})

test('applyPromotion: percent cap, min nights, flat never exceeds subtotal', () => {
  const pct = { code: 'P', discountType: 'percent' as const, discountValue: 50 }
  assert.equal(applyPromotion(1000, 2, pct), 500)
  assert.equal(applyPromotion(1000, 2, { ...pct, maxDiscountAmount: 200 }), 200)
  assert.equal(applyPromotion(1000, 1, { ...pct, minNights: 2 }), 0)
  assert.equal(applyPromotion(300, 1, { code: 'F', discountType: 'flat', discountValue: 500 }), 300)
  assert.equal(applyPromotion(1000, 2, null), 0)
})
