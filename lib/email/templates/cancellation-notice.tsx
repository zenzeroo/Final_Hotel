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

export function CancellationNoticeEmail({
  bookingCode,
  guestName,
  policyName,
  penaltyAmount,
  currency,
  noRefund,
  refundAmount,
  viewUrl,
  locale = 'th',
}: CancellationNoticeData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.cancellationNotice.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {t('email.cancellationNotice.heading')}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>{t('email.cancellationNotice.body', { code: bookingCode, policy: policyName })}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            {noRefund ? (
              <>
                <Text style={{ margin: '4px 0' }}>{t('email.cancellationNotice.noRefund')}</Text>
                <Text style={{ margin: '4px 0' }}>
                  {t('email.cancellationNotice.penalty')}: <strong>{formatEmailMoney(penaltyAmount, currency, locale)}</strong>
                </Text>
              </>
            ) : (
              <>
                <Text style={{ margin: '4px 0' }}>
                  {t('email.cancellationNotice.refundRequested', {
                    amount: formatEmailMoney(refundAmount ?? 0, currency, locale),
                  })}
                </Text>
                <Text style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>
                  {t('email.cancellationNotice.refundFollowUp')}
                </Text>
              </>
            )}
          </Section>
          <Text>
            {t('email.cancellationNotice.viewCta')} <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const cancellationNoticeSubject = (data: {
  bookingCode: string
  policyName: string
  locale?: Locale
}) =>
  getT(data.locale ?? 'th')('email.cancellationNotice.subject', {
    code: data.bookingCode,
    policy: data.policyName,
  })
