/**
 * Phase 27.D — email template i18n.
 *
 * Renders all 5 transactional templates in both locales and checks:
 *   1. EN output has no Thai characters; TH output contains its Thai heading.
 *   2. <html lang> matches the locale (th-TH / en-GB).
 *   3. Subject helpers are localized.
 *   4. No raw dictionary keys ("email.xxx") leak into the output.
 *   5. RefundNotice `auto` variant swaps the "manager approved" body.
 *   6. getRecipientLocale() reads profiles.locale of the booking owner
 *      (live DB, service role; restores the profile afterwards).
 *
 * Run: npx tsx scripts/test-phase27-email-i18n.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const THAI = /[฀-๿]/
const RAW_KEY = /\bemail\.[a-zA-Z]+\.[a-zA-Z]+\b/

let failed = 0
let passed = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  const { render } = await import('@react-email/components')
  const bc = await import('../lib/email/templates/booking-confirmation')
  const pr = await import('../lib/email/templates/payment-receipt')
  const cn = await import('../lib/email/templates/cancellation-notice')
  const rn = await import('../lib/email/templates/refund-notice')
  const ct = await import('../lib/email/templates/checkout-thank-you')

  type Locale = 'th' | 'en'
  const cases: Array<{
    name: string
    thHeading: string
    el: (locale: Locale) => Parameters<typeof render>[0]
    subject: (locale: Locale) => string
  }> = [
    {
      name: 'booking_confirmation',
      thHeading: 'ยืนยันการจองเรียบร้อย',
      el: (locale) =>
        bc.BookingConfirmationEmail({
          bookingCode: 'ZZR-TEST1',
          guestName: 'Alex',
          roomTypeName: 'Garden Suite',
          checkIn: '2026-11-01',
          checkOut: '2026-11-03',
          nights: 2,
          total: 9000,
          currency: 'THB',
          viewUrl: 'https://example.com/bookings/1',
          locale,
        }),
      subject: (locale) => bc.bookingConfirmationSubject({ bookingCode: 'ZZR-TEST1', checkIn: '2026-11-01', locale }),
    },
    {
      name: 'payment_receipt',
      thHeading: 'ใบเสร็จรับเงิน',
      el: (locale) =>
        pr.PaymentReceiptEmail({
          bookingCode: 'ZZR-TEST1',
          guestName: 'Alex',
          amount: 9000,
          currency: 'THB',
          method: 'promptpay',
          paidAt: '2026-10-18T03:15:00Z',
          viewUrl: 'https://example.com/bookings/1',
          locale,
        }),
      subject: (locale) => pr.paymentReceiptSubject({ bookingCode: 'ZZR-TEST1', locale }),
    },
    {
      name: 'cancellation_notice',
      thHeading: 'ยกเลิกการจองเรียบร้อย',
      el: (locale) =>
        cn.CancellationNoticeEmail({
          bookingCode: 'ZZR-TEST1',
          guestName: 'Alex',
          outcome: 'refund_requested',
          minDays: 2,
          penaltyAmount: 0,
          refundAmount: 9000,
          currency: 'THB',
          viewUrl: 'https://example.com/bookings/1',
          locale,
        }),
      subject: (locale) => cn.cancellationNoticeSubject({ bookingCode: 'ZZR-TEST1', locale }),
    },
    {
      name: 'refund_notice',
      thHeading: 'คืนเงินบางส่วนเรียบร้อย',
      el: (locale) =>
        rn.RefundNoticeEmail({
          bookingCode: 'ZZR-TEST1',
          guestName: 'Alex',
          refundAmount: 4500,
          currency: 'THB',
          partial: true,
          etaDays: 7,
          viewUrl: 'https://example.com/bookings/1',
          locale,
        }),
      subject: (locale) => rn.refundNoticeSubject({ bookingCode: 'ZZR-TEST1', locale }),
    },
    {
      name: 'checkout_thank_you',
      thHeading: 'ขอบคุณที่เลือกพักกับเรา',
      el: (locale) =>
        ct.CheckoutThankYouEmail({
          bookingCode: 'ZZR-TEST1',
          guestName: 'Alex',
          nightsStayed: 2,
          total: 9000,
          currency: 'THB',
          reviewUrl: 'https://example.com/bookings/1',
          locale,
        }),
      subject: (locale) => ct.checkoutThankYouSubject({ bookingCode: 'ZZR-TEST1', locale }),
    },
  ]

  for (const c of cases) {
    console.log(`\n${c.name}`)
    const en = await render(c.el('en'))
    const th = await render(c.el('th'))
    check('EN body has no Thai', !THAI.test(en), en.match(new RegExp(`.{0,30}${THAI.source}.{0,30}`))?.[0])
    check('TH body has Thai heading', th.includes(c.thHeading))
    check('EN <html lang="en-GB">', /<html[^>]*lang="en-GB"/.test(en))
    check('TH <html lang="th-TH">', /<html[^>]*lang="th-TH"/.test(th))
    check('no raw dictionary keys', !RAW_KEY.test(en) && !RAW_KEY.test(th), (en.match(RAW_KEY) ?? th.match(RAW_KEY))?.[0])
    const sEn = c.subject('en')
    const sTh = c.subject('th')
    check('EN subject has no Thai', !THAI.test(sEn), sEn)
    check('TH subject has Thai', THAI.test(sTh), sTh)
    check('subjects carry booking code', sEn.includes('ZZR-TEST1') && sTh.includes('ZZR-TEST1'))
  }

  console.log('\nrefund_notice auto variant')
  const auto = await render(
    rn.RefundNoticeEmail({
      bookingCode: 'ZZR-TEST1',
      guestName: 'Alex',
      refundAmount: 9000,
      currency: 'THB',
      partial: false,
      etaDays: 7,
      viewUrl: 'https://example.com/bookings/1',
      auto: true,
      locale: 'en',
    }),
  )
  check('auto body does not mention a manager', !/manager/i.test(auto))
  check('auto body explains the automatic refund', /refunded you automatically/.test(auto))

  console.log('\ngetRecipientLocale (live DB)')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('  - skipped (Supabase env not set)')
  } else {
    const { createClient } = await import('@supabase/supabase-js')
    const { getRecipientLocale } = await import('../lib/email/recipient-locale')
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: booking } = await admin
      .from('bookings')
      .select('id, user_id')
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    if (!booking) {
      console.log('  - skipped (no bookings in DB)')
    } else {
      const { data: profile } = await admin.from('profiles').select('locale').eq('id', booking.user_id).single()
      const original = profile?.locale ?? 'th'
      try {
        await admin.from('profiles').update({ locale: 'en' }).eq('id', booking.user_id)
        check('by userId → en', (await getRecipientLocale({ userId: booking.user_id })) === 'en')
        check('by bookingId → en', (await getRecipientLocale({ bookingId: booking.id })) === 'en')
        await admin.from('profiles').update({ locale: 'th' }).eq('id', booking.user_id)
        check('by userId → th', (await getRecipientLocale({ userId: booking.user_id })) === 'th')
      } finally {
        await admin.from('profiles').update({ locale: original }).eq('id', booking.user_id)
      }
      check('unknown user falls back to a valid locale', ['th', 'en'].includes(
        await getRecipientLocale({ userId: '00000000-0000-0000-0000-000000000000' }),
      ))
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
