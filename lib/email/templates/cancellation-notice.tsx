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

/**
 * Phase 57b — why the guest does / doesn't get money back:
 *   refund_requested — paid, cancelled ≥ minDays before check-in
 *   too_late         — paid, cancelled < minDays before check-in
 *   unpaid           — nothing was paid, nothing to refund
 */
export type CancellationOutcome = 'refund_requested' | 'too_late' | 'unpaid'

export interface CancellationNoticeData {
  bookingCode: string
  guestName: string
  outcome: CancellationOutcome
  /** refund_min_days_before_checkin() — shown in the too_late text. */
  minDays: number
  penaltyAmount: number
  currency: string
  refundAmount?: number
  viewUrl: string
}

export function CancellationNoticeEmail({
  bookingCode,
  guestName,
  outcome,
  minDays,
  penaltyAmount,
  currency,
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
          <Text>{t('email.cancellationNotice.body', { code: bookingCode })}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            {outcome === 'unpaid' ? (
              <Text style={{ margin: '4px 0' }}>{t('email.cancellationNotice.unpaid')}</Text>
            ) : outcome === 'too_late' ? (
              <>
                <Text style={{ margin: '4px 0' }}>{t('email.cancellationNotice.noRefund', { min: minDays })}</Text>
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
  locale?: Locale
}) =>
  getT(data.locale ?? 'th')('email.cancellationNotice.subject', {
    code: data.bookingCode,
  })
