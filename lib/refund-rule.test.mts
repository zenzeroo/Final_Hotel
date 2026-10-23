/**
 * Unit tests for the guest refund rule (Phase 57c).
 * Run with:  npm run test:unit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refundDeadlineIso, isRefundable, refundDeadlineOrNull } from './refund-rule'

test('deadline is minDays calendar days before check-in', () => {
  assert.equal(refundDeadlineIso('2026-10-24', 2), '2026-10-22')
  assert.equal(refundDeadlineIso('2026-11-01', 2), '2026-10-30') // crosses a month
  assert.equal(refundDeadlineIso('2027-01-01', 2), '2026-12-30') // crosses a year
})

test('refundable on the deadline day, not the day after', () => {
  assert.equal(isRefundable('2026-10-24', 2, '2026-10-21'), true)
  assert.equal(isRefundable('2026-10-24', 2, '2026-10-22'), true)
  assert.equal(isRefundable('2026-10-24', 2, '2026-10-23'), false)
  assert.equal(isRefundable('2026-10-24', 2, '2026-10-24'), false)
})

test('refundDeadlineOrNull returns null inside the no-refund window', () => {
  assert.equal(refundDeadlineOrNull('2026-10-24', 2, '2026-10-20'), '2026-10-22')
  assert.equal(refundDeadlineOrNull('2026-10-24', 2, '2026-10-23'), null)
})
