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

export interface RefundNoticeData {
  bookingCode: string
  guestName: string
  refundAmount: number
  currency: string
  /** True for partial refunds (the rest is forfeit per policy). */
  partial: boolean
  /** Approximate ETA in business days. */
  etaDays: number
  viewUrl: string
}

const formatTHB = (amount: number, currency: string): string =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

export function RefundNoticeEmail({
  bookingCode,
  guestName,
  refundAmount,
  currency,
  partial,
  etaDays,
  viewUrl,
}: RefundNoticeData) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{`คืนเงินการจอง ${bookingCode} เรียบร้อย`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {partial ? 'คืนเงินบางส่วนเรียบร้อย' : 'คืนเงินเรียบร้อย'}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>สวัสดีค่ะ คุณ{guestName}</Text>
          <Text>
            ผู้จัดการได้อนุมัติคำขอคืนเงินสำหรับการจอง{' '}
            <strong>{bookingCode}</strong> แล้ว
          </Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '8px 0 4px', fontSize: 18 }}>
              ยอดคืน: <strong>{formatTHB(refundAmount, currency)}</strong>
            </Text>
            <Text style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>
              เงินจะปรากฏในบัญชีของท่านภายใน {etaDays} วันทำการ
              (ขึ้นกับธนาคารผู้ออกบัตร)
            </Text>
          </Section>
          <Text>
            ดูประวัติการคืนเงิน: <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>
            หากมีคำถามเกี่ยวกับการคืนเงิน ติดต่อ booking@zenzero.com
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const refundNoticeSubject = (data: RefundNoticeData) =>
  `[Zenzero] คืนเงินการจอง ${data.bookingCode}`
