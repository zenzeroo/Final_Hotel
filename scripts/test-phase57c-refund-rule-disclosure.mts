/**
 * Phase 57c — the refund rule shown to guests before/after booking.
 *
 *   1. refundDeadlineIso / isRefundable boundaries (today, +1, +2, month + leap rollover)
 *   2. refundDeadlineOrNull returns null inside the no-refund window
 *   3. acceptRefundRuleSchema: only `true` passes, message is the dictionary key
 *   4. translateZodIssues turns that key into TH / EN text (no raw key)
 *   5. booking confirmation email (TH + EN): deadline line / no-refund line / hidden
 *   6. payment receipt email (TH + EN): same
 *
 * Pure — no DB, no network. Run: npx tsx scripts/test-phase57c-refund-rule-disclosure.mts
 */
import { refundDeadlineIso, isRefundable, refundDeadlineOrNull } from '../lib/refund-rule'
import { acceptRefundRuleSchema } from '../lib/validation/refund-rule'
import { translateZodIssues } from '../lib/errors/translate'

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<string | void> | string | void) {
  try {
    const r = await fn()
    console.log('  ✓ ' + name + (r ? ' — ' + r : ''))
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}
function eq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

console.log('Phase 57c — refund rule disclosure')

await step('1. deadline + isRefundable boundaries', () => {
  eq(refundDeadlineIso('2026-10-24', 2), '2026-10-22', 'deadline')
  eq(isRefundable('2026-10-24', 2, '2026-10-22'), true, 'check-in in 2 days')
  eq(isRefundable('2026-10-23', 2, '2026-10-22'), false, 'check-in in 1 day')
  eq(isRefundable('2026-10-22', 2, '2026-10-22'), false, 'check-in today')
  eq(refundDeadlineIso('2026-11-01', 2), '2026-10-30', 'month rollover')
  eq(refundDeadlineIso('2028-03-01', 2), '2028-02-28', 'leap year')
})

await step('2. refundDeadlineOrNull', () => {
  eq(refundDeadlineOrNull('2026-10-30', 2, '2026-10-22'), '2026-10-28', 'refundable')
  eq(refundDeadlineOrNull('2026-10-23', 2, '2026-10-22'), null, 'too late')
})

await step('3. acceptRefundRuleSchema only accepts true', () => {
  eq(acceptRefundRuleSchema.safeParse(true).success, true, 'true')
  for (const v of [false, undefined, 'true', 1]) {
    const r = acceptRefundRuleSchema.safeParse(v)
    eq(r.success, false, `value ${JSON.stringify(v)}`)
    if (!r.success) eq(r.error.issues[0].message, 'validation.acceptRefundRule', 'message key')
  }
})

await step('4. validation message is translated', () => {
  const r = acceptRefundRuleSchema.safeParse(false)
  if (r.success) throw new Error('should fail')
  const th = translateZodIssues(r.error.issues, 'th')
  const en = translateZodIssues(r.error.issues, 'en')
  if (!th.includes('เงื่อนไขการคืนเงิน')) throw new Error('TH: ' + th)
  if (!/refund policy/i.test(en)) throw new Error('EN: ' + en)
  return `${th} / ${en}`
})

const { render } = await import('@react-email/components')
const bc = await import('../lib/email/templates/booking-confirmation')
const pr = await import('../lib/email/templates/payment-receipt')
const { formatEmailDate } = await import('../lib/email/format')
// Emails use their own date style (same as the check-in line in the email).
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const thDate = esc(formatEmailDate('2026-10-28'))
const enDate = esc(formatEmailDate('2026-10-28'))

function checkLine(html: string, expect: RegExp | null, label: string) {
  const text = html.replace(/<!--[^>]*-->/g, '')
  if (/email\.(bookingConfirmation|paymentReceipt)\.refund/.test(text)) throw new Error(`${label}: raw key`)
  if (expect && !expect.test(text)) throw new Error(`${label}: missing ${expect}`)
  if (!expect && /(ขอคืนเงิน|refund)/i.test(text)) throw new Error(`${label}: refund line should be hidden`)
}

await step('5. booking confirmation email lines (TH + EN)', async () => {
  const base = {
    bookingCode: 'ZZR-57C', guestName: 'Alex', roomTypeName: 'Deluxe', checkIn: '2026-10-30',
    checkOut: '2026-10-31', nights: 1, total: 1220, currency: 'THB', viewUrl: 'https://example.com/b/1',
  }
  checkLine(await render(bc.BookingConfirmationEmail({ ...base, locale: 'th', refund: { minDays: 2, deadline: '2026-10-28' } })), new RegExp(`ขอคืนเงินก่อนวันเช็คอิน 2 วัน ได้เงินคืนเต็มจำนวน — สำหรับการจองนี้ขอได้ถึงวันที่ ${thDate}`), 'TH deadline')
  checkLine(await render(bc.BookingConfirmationEmail({ ...base, locale: 'en', refund: { minDays: 2, deadline: '2026-10-28' } })), new RegExp(`for this booking, until ${enDate}`), 'EN deadline')
  checkLine(await render(bc.BookingConfirmationEmail({ ...base, locale: 'th', refund: { minDays: 2, deadline: null } })), /น้อยกว่า 2 วันก่อนเช็คอิน/, 'TH none')
  checkLine(await render(bc.BookingConfirmationEmail({ ...base, locale: 'en', refund: { minDays: 2, deadline: null } })), /less than 2 days away/, 'EN none')
  checkLine(await render(bc.BookingConfirmationEmail({ ...base, locale: 'th' })), null, 'no refund prop')
})

await step('6. payment receipt email lines (TH + EN)', async () => {
  const base = {
    bookingCode: 'ZZR-57C', guestName: 'Alex', amount: 1220, currency: 'THB', method: 'card' as const,
    paidAt: '2026-10-22T03:00:00Z', viewUrl: 'https://example.com/b/1',
  }
  checkLine(await render(pr.PaymentReceiptEmail({ ...base, locale: 'th', refund: { minDays: 2, deadline: '2026-10-28' } })), new RegExp(`ขอคืนเงินก่อนวันเช็คอิน 2 วัน ได้เงินคืนเต็มจำนวน — สำหรับการจองนี้ขอได้ถึงวันที่ ${thDate}`), 'TH deadline')
  checkLine(await render(pr.PaymentReceiptEmail({ ...base, locale: 'en', refund: { minDays: 2, deadline: null } })), /less than 2 days away/, 'EN none')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
