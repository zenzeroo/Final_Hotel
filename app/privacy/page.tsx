import type { Metadata } from 'next'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent'
import { formatBangkokDate } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const PRIVACY_EMAIL = 'privacy@zenzerohotel.xyz'

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getLocale())
  return { title: t('privacyPage.metaTitle'), description: t('privacyPage.metaDescription') }
}

/**
 * Phase 61 — rewritten for PDPA: every field the app collects, legal basis,
 * retention, sharing (incl. storage abroad), rights, and the real policy
 * version (PRIVACY_POLICY_VERSION — the same value /consent checks).
 * Changing this text means bumping PRIVACY_POLICY_VERSION in lib/consent.ts.
 */
export default async function PrivacyPage() {
  const t = getT(await getLocale())

  const contactLink = (
    <a
      href={`mailto:${PRIVACY_EMAIL}`}
      className="text-primary px-1 py-0.5 rounded hover:bg-primary-fixed hover:text-primary transition-colors duration-200"
    >
      {PRIVACY_EMAIL}
    </a>
  )

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              {t('privacyPage.eyebrow')}
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              {t('privacyPage.title')}
            </h1>

            <div className="prose-like space-y-6 text-body-md text-on-surface-variant">
              <p className="text-body-lg text-on-surface">{t('privacyPage.intro')}</p>

              <Section title={t('privacyPage.controllerTitle')}>
                <p>
                  {t('privacyPage.controllerBody')} {contactLink}
                </p>
              </Section>

              <Section title={t('privacyPage.collectTitle')}>
                <List
                  items={[
                    t('privacyPage.collect1'),
                    t('privacyPage.collect2'),
                    t('privacyPage.collect3'),
                    t('privacyPage.collect4'),
                    t('privacyPage.collect5'),
                    t('privacyPage.collect6'),
                  ]}
                />
              </Section>

              <Section title={t('privacyPage.purposeTitle')}>
                <List
                  items={[
                    t('privacyPage.purpose1'),
                    t('privacyPage.purpose2'),
                    t('privacyPage.purpose3'),
                    t('privacyPage.purpose4'),
                  ]}
                />
              </Section>

              <Section title={t('privacyPage.marketingTitle')}>
                <p>{t('privacyPage.marketingBody')}</p>
              </Section>

              <Section title={t('privacyPage.shareTitle')}>
                <p>{t('privacyPage.shareIntro')}</p>
                <List
                  items={[
                    t('privacyPage.share1'),
                    t('privacyPage.share2'),
                    t('privacyPage.share3'),
                    t('privacyPage.share4'),
                  ]}
                />
                <p>{t('privacyPage.shareAbroad')}</p>
              </Section>

              <Section title={t('privacyPage.retentionTitle')}>
                <List
                  items={[
                    t('privacyPage.retention1'),
                    t('privacyPage.retention2'),
                    t('privacyPage.retention3'),
                  ]}
                />
              </Section>

              <Section title={t('privacyPage.rightsTitle')}>
                <p>{t('privacyPage.rightsIntro')}</p>
                <List
                  items={[
                    t('privacyPage.right1'),
                    t('privacyPage.right2'),
                    t('privacyPage.right3'),
                    t('privacyPage.right4'),
                    t('privacyPage.right5'),
                    t('privacyPage.right6'),
                  ]}
                />
                <p>
                  {t('privacyPage.contact')} {contactLink}
                </p>
              </Section>

              <Section title={t('privacyPage.cookiesTitle')}>
                <p>{t('privacyPage.cookiesBody')}</p>
              </Section>

              <p className="text-caption text-on-surface-variant/70 pt-4">
                {t('privacyPage.version', { date: formatBangkokDate(PRIVACY_POLICY_VERSION) })} — Zenzero Hotel
              </p>
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

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
