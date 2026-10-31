import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getHotelSettings } from '@/lib/data/manager'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getLocale())
  return {
    title: t('customer.meta.contactTitle'),
    description: t('customer.meta.contactDescription'),
  }
}

/** Phone, email, address and stay times come from the admin's hotel settings. */
export default async function ContactPage() {
  const [locale, settings] = await Promise.all([getLocale(), getHotelSettings()])
  const t = getT(locale)
  const hotelName = (locale === 'th' && settings?.name_th) || settings?.name || 'Zenzero Hotel'
  const phone = settings?.phone ?? ''
  const email = settings?.email ?? ''
  const address = settings?.address ?? ''
  const hhmm = (time: string | undefined) => (time ?? '').slice(0, 5)
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotelName}, ${address}`)}`
  const link = 'text-primary underline underline-offset-4 hover:bg-primary-fixed rounded px-0.5'

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mb-4">{t('customer.contact.heading')}</h1>
            <p className="text-body-lg text-on-surface mb-10">{t('customer.contact.intro')}</p>

            <div className="grid gap-6 md:grid-cols-2">
              {phone && (
                <ContactCard icon="call" label={t('customer.contact.phone')} hint={t('customer.contact.phoneHint')}>
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={link}>
                    {phone}
                  </a>
                </ContactCard>
              )}
              {email && (
                <ContactCard icon="mail" label={t('customer.contact.email')} hint={t('customer.contact.emailHint')}>
                  <a href={`mailto:${email}`} className={link}>
                    {email}
                  </a>
                </ContactCard>
              )}
              {address && (
                <ContactCard icon="location_on" label={t('customer.contact.address')}>
                  <span>{address}</span>
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-body-md text-primary underline underline-offset-4"
                  >
                    <MaterialIcon name="map" size={16} />
                    {t('customer.contact.openMap')}
                  </a>
                </ContactCard>
              )}
              <ContactCard icon="schedule" label={t('customer.contact.hours')} hint={t('customer.contact.hoursHint')}>
                {t('customer.contact.hoursValue', {
                  checkIn: hhmm(settings?.check_in_time),
                  checkOut: hhmm(settings?.check_out_time),
                })}
              </ContactCard>
            </div>

            <section className="mt-12 pt-8 border-t border-outline-variant">
              <h2 className="font-display text-xl text-on-surface mb-4">{t('customer.contact.otherHeading')}</h2>
              <div className="space-y-3 text-body-md text-on-surface-variant">
                <p>
                  <strong className="text-on-surface">{t('customer.contact.forBookings')}</strong>{' '}
                  <Link href="/rooms" className={link}>
                    {t('customer.contact.bookOnline')}
                  </Link>
                  {phone && <> {t('customer.contact.orCall', { phone })}</>}
                </p>
                <p>
                  <strong className="text-on-surface">{t('customer.contact.forPayments')}</strong>{' '}
                  <a href="mailto:billing@zenzero.com" className={link}>
                    billing@zenzero.com
                  </a>
                </p>
                <p>
                  <strong className="text-on-surface">{t('customer.contact.forPrivacy')}</strong>{' '}
                  <a href="mailto:privacy@zenzero.com" className={link}>
                    privacy@zenzero.com
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function ContactCard({
  icon,
  label,
  hint,
  children,
}: {
  icon: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6">
      <MaterialIcon name={icon} size={28} className="text-primary mb-3" />
      <p className="text-body-md text-on-surface-variant mb-1">{label}</p>
      <div className="font-display text-lg text-on-surface mb-1 flex flex-col items-start">{children}</div>
      {hint && <p className="text-caption text-on-surface-variant">{hint}</p>}
    </div>
  )
}
