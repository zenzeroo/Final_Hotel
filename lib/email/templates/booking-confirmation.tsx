import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'

export interface BookingConfirmationData {
  bookingCode: string
  guestName: string
  roomTypeName: string
  checkIn: string
  checkOut: string
  nights: number
  total: number
  currency: string
  viewUrl: string
}

/**
 * Phase 26 — i18n. Each template accepts a `locale` prop and renders
 * English when locale === 'en'. Strings are NOT pulled from the
 * dictionary (email templates render outside the React tree; the
 * dictionary is a client+server tree-only construct). Instead the
 * EN strings are inlined as a small const map per template.
 *
 * The Subject helper is also locale-aware.
 */
type Strings = {
  subject: string
  heading: string
  greeting: (name: string) => string
  intro: string
  bookingCode: string
  roomType: string
  checkIn: string
  checkOut: string
  nights: (n: number) => string
  total: string
  viewCta: string
  footer: string
}

const EN: Strings = {
  subject: 'Booking confirmed',
  heading: 'Your booking is confirmed',
  greeting: (name: string) => `Hello ${name}`,
  intro:
    'Thank you for choosing Zenzero Hotel. We have received your booking. Here are the details:',
  bookingCode: 'Booking code',
  roomType: 'Room type',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: (n: number) => `Number of nights: ${n}`,
  total: 'Total',
  viewCta: 'View booking details and pay at:',
  footer: 'For questions, contact us at booking@zenzero.com',
}

const TH: Strings = {
  subject: 'ยืนยันการจอง',
  heading: 'ยืนยันการจองเรียบร้อย',
  greeting: (name: string) => `สวัสดีค่ะ คุณ${name}`,
  intro: 'ขอบคุณที่เลือกใช้บริการ Zenzero Hotel เราได้รับการจองของท่านเรียบร้อยแล้ว รายละเอียดมีดังนี้',
  bookingCode: 'รหัสการจอง',
  roomType: 'ประเภทห้อง',
  checkIn: 'เช็คอิน',
  checkOut: 'เช็คเอาท์',
  nights: (n: number) => `จำนวนคืน: ${n}`,
  total: 'ยอดรวม',
  viewCta: 'ดูรายละเอียดการจองและชำระเงินได้ที่:',
  footer: 'หากมีคำถามเพิ่มเติม ติดต่อเราได้ที่ booking@zenzero.com',
}

const STRINGS: Record<Locale, Strings> = { th: TH, en: EN }

const formatTHB = (amount: number, currency: string, locale: Locale): string =>
  new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)

export function BookingConfirmationEmail({
  bookingCode,
  guestName,
  roomTypeName,
  checkIn,
  checkOut,
  nights,
  total,
  currency,
  viewUrl,
  locale = 'th',
}: BookingConfirmationData & { locale?: Locale }) {
  const s = STRINGS[locale]
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{`${s.subject} ${bookingCode} — Zenzero Hotel`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>{s.heading}</Heading>
          <Text style={{ color: '#1a1a1a' }}>{s.greeting(guestName)}</Text>
          <Text>{s.intro}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>{s.bookingCode}: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '4px 0' }}>{s.roomType}: {roomTypeName}</Text>
            <Text style={{ margin: '4px 0' }}>{s.checkIn}: {checkIn}</Text>
            <Text style={{ margin: '4px 0' }}>{s.checkOut}: {checkOut}</Text>
            <Text style={{ margin: '4px 0' }}>{s.nights(nights)}</Text>
            <Text style={{ margin: '4px 0', fontSize: 16 }}>
              {s.total}: <strong>{formatTHB(total, currency, locale)}</strong>
            </Text>
          </Section>
          <Text>
            {s.viewCta} <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{s.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const bookingConfirmationSubject = (
  data: BookingConfirmationData & { locale?: Locale },
) => {
  const s = STRINGS[data.locale ?? 'th']
  return `[Zenzero] ${s.subject} ${data.bookingCode} — ${data.checkIn}`
}
