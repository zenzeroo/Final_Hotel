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

const formatTHB = (amount: number, currency: string): string =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

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
}: BookingConfirmationData) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{`ยืนยันการจอง ${bookingCode} — Zenzero Hotel`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            ยืนยันการจองเรียบร้อย
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>สวัสดีค่ะ คุณ{guestName}</Text>
          <Text>
            ขอบคุณที่เลือกใช้บริการ Zenzero Hotel เราได้รับการจองของท่านเรียบร้อยแล้ว
            รายละเอียดมีดังนี้
          </Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>รหัสการจอง: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '4px 0' }}>ประเภทห้อง: {roomTypeName}</Text>
            <Text style={{ margin: '4px 0' }}>เช็คอิน: {checkIn}</Text>
            <Text style={{ margin: '4px 0' }}>เช็คเอาท์: {checkOut}</Text>
            <Text style={{ margin: '4px 0' }}>จำนวนคืน: {nights}</Text>
            <Text style={{ margin: '4px 0', fontSize: 16 }}>
              ยอดรวม: <strong>{formatTHB(total, currency)}</strong>
            </Text>
          </Section>
          <Text>
            ดูรายละเอียดการจองและชำระเงินได้ที่:{' '}
            <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>
            หากมีคำถามเพิ่มเติม ติดต่อเราได้ที่ booking@zenzero.com
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const bookingConfirmationSubject = (data: BookingConfirmationData) =>
  `[Zenzero] ยืนยันการจอง ${data.bookingCode} — ${data.checkIn}`
