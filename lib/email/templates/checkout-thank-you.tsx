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

export interface CheckoutThankYouData {
  bookingCode: string
  guestName: string
  nightsStayed: number
  total: number
  currency: string
  reviewUrl: string
}

export function CheckoutThankYouEmail({
  bookingCode,
  guestName,
  nightsStayed,
  total,
  currency,
  reviewUrl,
  locale = 'th',
}: CheckoutThankYouData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.checkoutThankYou.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {t('email.checkoutThankYou.heading')}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>{t('email.checkoutThankYou.body', { count: nightsStayed })}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>{t('email.common.bookingCode')}: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '8px 0 4px', fontSize: 16 }}>
              {t('email.checkoutThankYou.total')}: <strong>{formatEmailMoney(total, currency, locale)}</strong>
            </Text>
          </Section>
          <Text>
            {t('email.checkoutThankYou.reviewPrompt')}{' '}
            <a href={reviewUrl} style={{ color: '#3d5a40' }}>{t('email.checkoutThankYou.writeReview')}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{t('email.common.signature')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const checkoutThankYouSubject = (data: { bookingCode: string; locale?: Locale }) =>
  getT(data.locale ?? 'th')('email.checkoutThankYou.subject', { code: data.bookingCode })
