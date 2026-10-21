import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
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

export default async function AboutPage() {
  const t = getT(await getLocale())
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

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              {t('customer.about.label')}
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              {t('customer.about.title')}
            </h1>

            <div className="space-y-6 text-body-md text-on-surface-variant">
              <p className="text-body-lg text-on-surface">{t('customer.about.intro')}</p>

              <Section title={t('customer.about.visionTitle')}>
                <p>{t('customer.about.vision')}</p>
              </Section>

              <Section title={t('customer.about.valuesTitle')}>
                <ul className="list-disc list-inside space-y-2">
                  {values.map(([name, body]) => (
                    <li key={name}>
                      <strong>{t(name)}</strong> — {t(body)}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title={t('customer.about.facilitiesTitle')}>
                <ul className="list-disc list-inside space-y-2">
                  {facilities.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
              </Section>

              <Section title={t('customer.about.bookingTitle')}>
                <p>{t('customer.about.booking')}</p>
                <p>
                  <Link href="/rooms" className="text-primary px-2 py-1 rounded hover:bg-primary-fixed hover:text-primary font-semibold">
                    {t('customer.about.seeRooms')}
                  </Link>
                </p>
              </Section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-on-surface mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
