import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { listRoomTypes } from '@/lib/data/rooms'
import { localizedName } from '@/lib/format/roomType'
import { GINGER_PLATE, SUKHUMVIT_ROAD } from '@/lib/found-images'
import { r2Url } from '@/lib/r2/publicUrl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getLocale())
  return {
    title: t('customer.meta.aboutTitle'),
    description: t('customer.meta.aboutDescription'),
  }
}

/**
 * About — the hotel and the meaning of its name beside Köhler's ginger
 * plate, its vision, values, facilities with two rooms, and how to book.
 */
export default async function AboutPage() {
  const [locale, rooms] = await Promise.all([getLocale(), listRoomTypes({ isActive: true, isDeleted: false })])
  const t = getT(locale)
  const roomPhotos = rooms.filter((r) => r.hero_image_key).slice(0, 2)

  const values = [
    ['customer.about.sincerity', 'customer.about.sincerityBody'],
    ['customer.about.cleanliness', 'customer.about.cleanlinessBody'],
    ['customer.about.care', 'customer.about.careBody'],
    ['customer.about.sustainability', 'customer.about.sustainabilityBody'],
  ] as const
  const facilities = [
    'customer.about.wifi',
    'customer.about.pool',
    'customer.about.dining',
    'customer.about.parking',
    'customer.about.frontDesk',
  ] as const

  // Reading sizes: one modest heading step, 18px lead, 16px body, lines
  // kept to about 65 characters.
  const h2 = 'font-display text-2xl md:text-[28px] leading-[1.25] text-primary'
  const section = 'page-x py-14 md:py-20'

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <section className="page-x pt-10 md:pt-14 pb-14 md:pb-20 grid grid-cols-1 md:grid-cols-12 gap-y-10 md:gap-x-10 items-center">
          <div className="md:col-span-8">
            <h1 className="font-display text-[36px] md:text-[48px] leading-[1.15] tracking-[-0.01em] text-primary">
              {t('customer.about.title')}
            </h1>
            <p className="mt-6 max-w-[62ch] text-body-lg leading-[1.75] text-on-surface">
              {t('customer.about.intro')}
            </p>
            <p className="mt-4 text-body-md text-on-surface-variant">{t('landing.meaning')}</p>
          </div>
          <figure className="md:col-start-10 md:col-span-3 max-w-[240px] md:max-w-none">
            <div className="relative aspect-[4/5] bg-surface-container-lowest">
              <Image
                src={GINGER_PLATE.src}
                alt={GINGER_PLATE.alt[locale]}
                fill
                priority
                sizes="(min-width: 768px) 22vw, 240px"
                className="object-contain"
              />
            </div>
            <figcaption className="mt-2 text-[13px] text-on-surface-variant">{GINGER_PLATE.creator}</figcaption>
          </figure>
        </section>

        <section className={`${section} bg-surface-container-low`} aria-labelledby="vision-heading">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-4 md:gap-x-10">
            <h2 id="vision-heading" className={`${h2} md:col-span-4`}>{t('customer.about.visionTitle')}</h2>
            <p className="md:col-span-8 max-w-[62ch] text-body-lg leading-[1.75] text-on-surface">
              {t('customer.about.vision')}
            </p>
          </div>
        </section>

        <section className={section} aria-labelledby="values-heading">
          <h2 id="values-heading" className={`${h2} mb-8`}>{t('customer.about.valuesTitle')}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(([name, body]) => (
              <div key={name} className="bg-surface-container-lowest rounded-2xl p-6">
                <dt className="text-body-lg font-semibold text-primary">{t(name)}</dt>
                <dd className="mt-2 text-body-md leading-[1.7] text-on-surface">{t(body)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${section} bg-surface-container-low`} aria-labelledby="facilities-heading">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-8 md:gap-x-10 items-start">
            <div className="md:col-span-5">
              <h2 id="facilities-heading" className={h2}>{t('customer.about.facilitiesTitle')}</h2>
              <ul className="mt-6 flex flex-col gap-3 text-body-lg text-on-surface">
                {facilities.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <MaterialIcon name="check" size={20} className="text-primary mt-1 shrink-0" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-6 md:col-start-7 grid grid-cols-2 gap-4">
              {roomPhotos.map((room) => (
                <Link
                  key={room.id}
                  href={`/rooms/${room.slug}`}
                  className="group relative block aspect-[4/3] rounded-2xl overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <Image
                    src={r2Url(room.hero_image_key)}
                    alt={localizedName(room, locale)}
                    fill
                    loading="lazy"
                    sizes="(min-width: 768px) 22vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={section} aria-labelledby="booking-heading">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-4 md:gap-x-10 items-start">
            <h2 id="booking-heading" className={`${h2} md:col-span-4`}>{t('customer.about.bookingTitle')}</h2>
            <div className="md:col-span-8">
              <p className="max-w-[62ch] text-body-lg leading-[1.75] text-on-surface">{t('customer.about.booking')}</p>
              <Link
                href="/rooms"
                className="mt-6 inline-flex items-center h-12 px-6 rounded-full bg-primary text-on-primary font-semibold text-body-md hover:bg-primary-container active:translate-y-px transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('customer.about.seeRooms')}
              </Link>
            </div>
          </div>
          <figure className="mt-12">
            <div className="relative w-full aspect-[16/9] md:aspect-[21/8] rounded-2xl overflow-hidden">
              <Image src={SUKHUMVIT_ROAD.src} alt={SUKHUMVIT_ROAD.alt[locale]} fill loading="lazy" sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-body-md text-on-surface-variant">{t('landing.whereCaption')}</figcaption>
          </figure>
        </section>
      </main>
      <Footer />
    </>
  )
}
