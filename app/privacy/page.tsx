import type { Metadata } from 'next'
import { PRIVACY_POLICY_VERSION } from '@/lib/consent'
import { formatBangkokDate } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { getCurrentLegalVersion } from '@/lib/data/legal'
import { PublishedLegalPage } from '@/components/legal/PublishedLegalPage'
import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell'

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
 * Phase 62 — this JSX is only the fallback until the admin publishes PDFs;
 * changing it before then still means bumping PRIVACY_POLICY_VERSION.
 */
export default async function PrivacyPage() {
  const locale = await getLocale()
  const t = getT(locale)

  // Phase 62 — once the admin has published PDFs (/admin/legal), show those.
  const published = await getCurrentLegalVersion()
  if (published) {
    return (
      <PublishedLegalPage
        kind="privacy"
        row={published}
        locale={locale}
        title={t('privacyPage.title')}
      />
    )
  }

  const contactLink = (
    <a
      href={`mailto:${PRIVACY_EMAIL}`}
      className="text-primary underline underline-offset-4 decoration-1 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      {PRIVACY_EMAIL}
    </a>
  )

  const sections: LegalSection[] = [
    {
      id: 'controller',
      title: t('privacyPage.controllerTitle'),
      body: (
        <p>
          {t('privacyPage.controllerBody')} {contactLink}
        </p>
      ),
    },
    {
      id: 'collect',
      title: t('privacyPage.collectTitle'),
      body: (
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
      ),
    },
    {
      id: 'purpose',
      title: t('privacyPage.purposeTitle'),
      body: (
        <List
          items={[
            t('privacyPage.purpose1'),
            t('privacyPage.purpose2'),
            t('privacyPage.purpose3'),
            t('privacyPage.purpose4'),
          ]}
        />
      ),
    },
    { id: 'marketing', title: t('privacyPage.marketingTitle'), body: <p>{t('privacyPage.marketingBody')}</p> },
    {
      id: 'sharing',
      title: t('privacyPage.shareTitle'),
      body: (
        <>
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
        </>
      ),
    },
    {
      id: 'retention',
      title: t('privacyPage.retentionTitle'),
      body: (
        <List items={[t('privacyPage.retention1'), t('privacyPage.retention2'), t('privacyPage.retention3')]} />
      ),
    },
    {
      id: 'rights',
      title: t('privacyPage.rightsTitle'),
      body: (
        <>
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
        </>
      ),
    },
    { id: 'cookies', title: t('privacyPage.cookiesTitle'), body: <p>{t('privacyPage.cookiesBody')}</p> },
  ]

  return (
    <LegalPageShell
      kind="privacy"
      locale={locale}
      title={t('privacyPage.title')}
      intro={t('privacyPage.intro')}
      updated={`${t('privacyPage.version', { date: formatBangkokDate(PRIVACY_POLICY_VERSION) })} — Zenzero Hotel`}
      sections={sections}
    />
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
