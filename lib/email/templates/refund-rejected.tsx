import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

export interface RefundRejectedData {
  bookingCode: string
  guestName: string
  reason: string
  viewUrl: string
}

export function RefundRejectedEmail({
  bookingCode,
  guestName,
  reason,
  viewUrl,
  locale = 'th',
}: RefundRejectedData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.refundRejected.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>{t('email.refundRejected.heading')}</Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>{t('email.refundRejected.body', { code: bookingCode })}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>
              {t('email.refundRejected.reason')}: <strong>{reason}</strong>
            </Text>
            <Text style={{ margin: '8px 0 4px' }}>{t('email.refundRejected.stay')}</Text>
          </Section>
          <Text>
            {t('email.refundRejected.viewCta')} <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{t('email.refundRejected.footer')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const refundRejectedSubject = (data: { bookingCode: string; locale?: Locale }) =>
  getT(data.locale ?? 'th')('email.refundRejected.subject', { code: data.bookingCode })
