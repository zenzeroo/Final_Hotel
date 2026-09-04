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

export interface CheckoutThankYouData {
  bookingCode: string
  guestName: string
  nightsStayed: number
  total: number
  currency: string
  reviewUrl: string
}

const formatTHB = (amount: number, currency: string): string =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

export function CheckoutThankYouEmail({
  bookingCode,
  guestName,
  nightsStayed,
  total,
  currency,
  reviewUrl,
}: CheckoutThankYouData) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{`ขอบคุณที่เข้าพักกับเรา — ${bookingCode}`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            ขอบคุณที่เลือกพักกับเรา
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>สวัสดีค่ะ คุณ{guestName}</Text>
          <Text>
            ขอบคุณที่เข้าพักกับ Zenzero Hotel เป็นเวลา {nightsStayed} คืน
            หวังว่าจะได้ต้อนรับท่านอีกครั้งในโอกาสหน้า
          </Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>รหัสการจอง: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '8px 0 4px', fontSize: 16 }}>
              ยอดรวมค่าเข้าพัก: <strong>{formatTHB(total, currency)}</strong>
            </Text>
          </Section>
          <Text>
            ร่วมแบ่งปันประสบการณ์ของท่าน:{' '}
            <a href={reviewUrl} style={{ color: '#3d5a40' }}>เขียนรีวิว</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>
            ทีมงาน Zenzero Hotel
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const checkoutThankYouSubject = (data: CheckoutThankYouData) =>
  `[Zenzero] ขอบคุณที่เข้าพัก — ${data.bookingCode}`
