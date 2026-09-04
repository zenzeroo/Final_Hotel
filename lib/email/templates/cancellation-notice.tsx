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

export interface CancellationNoticeData {
  bookingCode: string
  guestName: string
  policyName: string
  penaltyAmount: number
  currency: string
  /** True when no refund is owed (already outside free window). */
  noRefund: boolean
  /** Optional refund amount when inside the free window AND the booking was paid. */
  refundAmount?: number
  viewUrl: string
}

const formatTHB = (amount: number, currency: string): string =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)

export function CancellationNoticeEmail({
  bookingCode,
  guestName,
  policyName,
  penaltyAmount,
  currency,
  noRefund,
  refundAmount,
  viewUrl,
}: CancellationNoticeData) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{`ยกเลิกการจอง ${bookingCode} เรียบร้อย`}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            ยกเลิกการจองเรียบร้อย
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>สวัสดีค่ะ คุณ{guestName}</Text>
          <Text>
            การจอง <strong>{bookingCode}</strong> ถูกยกเลิกเรียบร้อยแล้ว
            ตามเงื่อนไขนโยบาย &ldquo;{policyName}&rdquo;
          </Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            {noRefund ? (
              <>
                <Text style={{ margin: '4px 0' }}>
                  การยกเลิกนี้อยู่นอกช่วงยกเลิกฟรี ไม่สามารถขอคืนเงินได้
                </Text>
                <Text style={{ margin: '4px 0' }}>
                  ค่าธรรมเนียมการยกเลิก: <strong>{formatTHB(penaltyAmount, currency)}</strong>
                </Text>
              </>
            ) : (
              <>
                <Text style={{ margin: '4px 0' }}>
                  คำขอคืนเงินจำนวน <strong>{formatTHB(refundAmount ?? 0, currency)}</strong> ถูกส่งให้ผู้จัดการพิจารณาแล้ว
                </Text>
                <Text style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>
                  ระบบจะแจ้งให้ท่านทราบอีกครั้งเมื่อการคืนเงินเสร็จสมบูรณ์
                </Text>
              </>
            )}
          </Section>
          <Text>
            ดูรายละเอียด: <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const cancellationNoticeSubject = (data: CancellationNoticeData) =>
  `[Zenzero] ยกเลิกการจอง ${data.bookingCode} — นโยบาย ${data.policyName}`
