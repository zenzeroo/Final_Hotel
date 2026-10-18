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
import { formatEmailDateTime, formatEmailMoney } from '../format'

export interface PaymentReceiptData {
  bookingCode: string
  guestName: string
  amount: number
  currency: string
  method: 'card' | 'promptpay' | 'cash'
  paidAt: string
  viewUrl: string
}

const METHOD_KEY: Record<PaymentReceiptData['method'], string> = {
  card: 'email.paymentReceipt.methodCard',
  promptpay: 'email.paymentReceipt.methodPromptpay',
  cash: 'email.paymentReceipt.methodCash',
}

export function PaymentReceiptEmail({
  bookingCode,
  guestName,
  amount,
  currency,
  method,
  paidAt,
  viewUrl,
  locale = 'th',
}: PaymentReceiptData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.paymentReceipt.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {t('email.paymentReceipt.heading')}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>{t('email.paymentReceipt.body', { code: bookingCode })}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>{t('email.common.bookingCode')}: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '4px 0' }}>{t('email.paymentReceipt.method')}: {t(METHOD_KEY[method])}</Text>
            <Text style={{ margin: '4px 0' }}>{t('email.paymentReceipt.paidAt')}: {formatEmailDateTime(paidAt, locale)}</Text>
            <Text style={{ margin: '8px 0 4px', fontSize: 18 }}>
              {t('email.paymentReceipt.amount')}: <strong>{formatEmailMoney(amount, currency, locale)}</strong>
            </Text>
          </Section>
          <Text>
            {t('email.paymentReceipt.viewCta')}{' '}
            <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{t('email.paymentReceipt.footer')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const paymentReceiptSubject = (data: { bookingCode: string; locale?: Locale }) =>
  getT(data.locale ?? 'th')('email.paymentReceipt.subject', { code: data.bookingCode })
