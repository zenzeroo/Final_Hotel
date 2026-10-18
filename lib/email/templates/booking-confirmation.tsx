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
import { formatEmailDate, formatEmailMoney } from '../format'

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

/**
 * Phase 27.D — strings come from the `email.*` dictionary namespace via
 * `getT(locale)` (sync, works outside the React tree). `locale` is the
 * guest's locale — see `lib/email/recipient-locale.ts`.
 */
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
  locale = 'th',
}: BookingConfirmationData & { locale?: Locale }) {
  const t = getT(locale)
  return (
    <Html lang={LOCALE_BCP47[locale]}>
      <Head />
      <Preview>{t('email.bookingConfirmation.preview', { code: bookingCode })}</Preview>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f0' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: 22, color: '#3d5a40', margin: 0 }}>
            {t('email.bookingConfirmation.heading')}
          </Heading>
          <Text style={{ color: '#1a1a1a' }}>{t('email.common.greeting', { name: guestName })}</Text>
          <Text>{t('email.bookingConfirmation.intro')}</Text>
          <Section style={{ borderTop: '1px solid #e0e0d0', borderBottom: '1px solid #e0e0d0', padding: '16px 0', margin: '16px 0' }}>
            <Text style={{ margin: '4px 0' }}>{t('email.common.bookingCode')}: <strong>{bookingCode}</strong></Text>
            <Text style={{ margin: '4px 0' }}>{t('email.bookingConfirmation.roomType')}: {roomTypeName}</Text>
            <Text style={{ margin: '4px 0' }}>{t('email.bookingConfirmation.checkIn')}: {formatEmailDate(checkIn, locale)}</Text>
            <Text style={{ margin: '4px 0' }}>{t('email.bookingConfirmation.checkOut')}: {formatEmailDate(checkOut, locale)}</Text>
            <Text style={{ margin: '4px 0' }}>{t('email.bookingConfirmation.nights', { count: nights })}</Text>
            <Text style={{ margin: '4px 0', fontSize: 16 }}>
              {t('email.bookingConfirmation.total')}: <strong>{formatEmailMoney(total, currency, locale)}</strong>
            </Text>
          </Section>
          <Text>
            {t('email.bookingConfirmation.viewCta')} <a href={viewUrl} style={{ color: '#3d5a40' }}>{viewUrl}</a>
          </Text>
          <Text style={{ color: '#666', fontSize: 14 }}>{t('email.bookingConfirmation.footer')}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const bookingConfirmationSubject = (data: {
  bookingCode: string
  checkIn: string
  locale?: Locale
}) => {
  const locale = data.locale ?? 'th'
  return getT(locale)('email.bookingConfirmation.subject', {
    code: data.bookingCode,
    date: formatEmailDate(data.checkIn, locale),
  })
}
