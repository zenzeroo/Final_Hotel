import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import Image from 'next/image'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { SUKHUMVIT_ROAD } from '@/lib/found-images'
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
  const link =
    'text-primary underline underline-offset-4 decoration-1 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'
  const checkIn = hhmm(settings?.check_in_time)
  const checkOut = hhmm(settings?.check_out_time)
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotelName}, ${address}`)}`
  const h2 = 'font-display text-2xl md:text-[28px] leading-[1.25] text-primary'

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <section className="page-x pt-10 md:pt-14 pb-10 md:pb-12">
          <h1 className="font-display text-[36px] md:text-[48px] leading-[1.15] tracking-[-0.01em] text-primary">
            {t('customer.contact.heading')}
          </h1>
          <p className="mt-4 max-w-[62ch] text-body-lg leading-[1.75] text-on-surface">{t('customer.contact.intro')}</p>
        </section>

        {/* Ways to reach us beside the street the hotel is on; both columns end level on desktop. */}
        <section className="page-x pb-14 md:pb-20 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-10 items-stretch">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 auto-rows-fr">
            {phone && (
              <ContactCard icon="call" label={t('customer.contact.phone')} hint={t('customer.contact.phoneHint')}>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={link}>{phone}</a>
              </ContactCard>
            )}
            {email && (
              <ContactCard icon="mail" label={t('customer.contact.email')} hint={t('customer.contact.emailHint')}>
                <a href={`mailto:${email}`} className={`${link} break-all`}>{email}</a>
              </ContactCard>
            )}
            {address && (
              <ContactCard icon="location_on" label={t('customer.contact.address')}>
                <span>{address}</span>
                <a href={mapHref} target="_blank" rel="noopener noreferrer" className={`${link} mt-2 text-body-md font-normal`}>
                  {t('customer.contact.openMap')}
                </a>
              </ContactCard>
            )}
            <ContactCard icon="schedule" label={t('customer.contact.hours')} hint={t('customer.contact.hoursHint')}>
              {t('customer.contact.hoursValue', { checkIn, checkOut })}
            </ContactCard>
          </div>

          <figure className="flex flex-col">
            <div className="relative flex-1 min-h-[260px] rounded-2xl overflow-hidden">
              <Image
                src={SUKHUMVIT_ROAD.src}
                alt={SUKHUMVIT_ROAD.alt[locale]}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-[14px] text-on-surface-variant">{t('landing.whereCaption')}</figcaption>
          </figure>
        </section>

        <section className="bg-surface-container-low py-14 md:py-20" aria-labelledby="other-heading">
          <div className="page-x">
            <h2 id="other-heading" className={`${h2} mb-8`}>{t('customer.contact.otherHeading')}</h2>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-container-lowest rounded-2xl p-6">
                <dt className="text-body-lg font-semibold text-primary">{t('customer.contact.forBookings')}</dt>
                <dd className="mt-2 text-body-md leading-[1.7] text-on-surface">
                  <Link href="/rooms" className={link}>{t('customer.contact.bookOnline')}</Link>
                  {phone && <> {t('customer.contact.orCall', { phone })}</>}
                </dd>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-6">
                <dt className="text-body-lg font-semibold text-primary">{t('customer.contact.forPayments')}</dt>
                <dd className="mt-2 text-body-md">
                  <a href="mailto:billing@zenzero.com" className={link}>billing@zenzero.com</a>
                </dd>
              </div>
              <div className="bg-surface-container-lowest rounded-2xl p-6">
                <dt className="text-body-lg font-semibold text-primary">{t('customer.contact.forPrivacy')}</dt>
                <dd className="mt-2 text-body-md">
                  <a href="mailto:privacy@zenzero.com" className={link}>privacy@zenzero.com</a>
                </dd>
              </div>
            </dl>
          </div>
        </section>
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
    <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col">
      <MaterialIcon name={icon} size={24} className="text-primary" />
      <p className="mt-4 text-[14px] text-on-surface-variant">{label}</p>
      <div className="mt-1 text-[20px] leading-[1.4] font-semibold text-primary flex flex-col items-start">{children}</div>
      {hint && <p className="mt-auto pt-3 text-[14px] text-on-surface-variant">{hint}</p>}
    </div>
  )
}
