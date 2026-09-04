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

export interface PaymentReceiptData {
  bookingCode: string
  guestName: string
  amount: number
  currency: string
  method: 'card' | 'promptpay' | 'cash'
  paidAt: string
  viewUrl: string
}

const methodLabel = (m: PaymentReceiptData['method']): string => {
  switch (m) {
    case 'card': return 'บัตรเครดิต/เดบิต'
    case 'promptpay': return 'พร้อมเพย์'
    case 'cash': return 'เงินสด (ชำระที่เคาน์เตอร์)'
  }
}

const formatTHB = (amount: number, currency: string): string =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

export function PaymentReceiptEmail({
  bookingCode,
  guestName,
  amount,
  currency,
  method,
  paidAt,
  viewUrl,
}: PaymentReceiptData) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{`ใบเสร็จชำระเงิน ${bookingCode}`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            ใบเสร็จรับเงิน
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>สวัสดีค่ะ คุณ{guestName}</Text>
          <Text>เราได้รับชำระเงินสำหรับการจอง {bookingCode} เรียบร้อยแล้ว</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>รหัสการจอง: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '4px 0' }}>วิธีชำระเงิน: {methodLabel(method)}</Text>
            <Text style={{ margin: '4px 0' }}>วันที่ชำระ: {paidAt}</Text>
            <Text style={{ margin: '8px 0 4px', fontSize: 18 }}>
              ยอดเงิน: <strong>{formatTHB(amount, currency)}</strong>
            </Text>
          </Section>
          <Text>
            ดูใบเสร็จฉบับเต็มได้ที่:{' '}
            <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>
            ขอบคุณที่ใช้บริการ Zenzero Hotel
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const paymentReceiptSubject = (data: PaymentReceiptData) =>
  `[Zenzero] ใบเสร็จการจอง ${data.bookingCode}`
