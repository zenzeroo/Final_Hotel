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
import { getT } from '@/lib/i18n/t'
import { formatEmailMoney } from '../format'

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
  /**
   * True for the webhook auto-refund (payment landed after the booking was
   * cancelled/expired) — no manager was involved, so the body says so.
   */
  auto?: boolean
}

export function RefundNoticeEmail({
  bookingCode,
  guestName,
  refundAmount,
  currency,
  partial,
  etaDays,
  viewUrl,
  auto = false,
  locale = 'th',
}: RefundNoticeData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.refundNotice.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {t(partial ? 'email.refundNotice.headingPartial' : 'email.refundNotice.headingFull')}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>
            {t(auto ? 'email.refundNotice.autoBody' : 'email.refundNotice.body', { code: bookingCode })}
          </Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '8px 0 4px', fontSize: 18 }}>
              {t('email.refundNotice.amount')}: <strong>{formatEmailMoney(refundAmount, currency, locale)}</strong>
            </Text>
            <Text style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>
              {t('email.refundNotice.eta', { days: etaDays })}
            </Text>
          </Section>
          <Text>
            {t('email.refundNotice.viewCta')} <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{t('email.refundNotice.footer')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const refundNoticeSubject = (data: { bookingCode: string; locale?: Locale }) =>
  getT(data.locale ?? 'th')('email.refundNotice.subject', { code: data.bookingCode })
