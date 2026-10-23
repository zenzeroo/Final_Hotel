import Link from 'next/link'
import type { AccountProfile } from '@/lib/data/types'
import { formatDateTime } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { MarketingConsentSwitch } from './MarketingConsentSwitch'

/**
 * Phase 61 — PDPA card on /account/profile: when the terms + privacy notice
 * were accepted, and the marketing consent switch (withdraw any time).
 */
export async function PrivacyConsentCard({ profile }: { profile: AccountProfile }) {
  const t = getT(await getLocale())
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container p-gutter md:p-[32px] flex flex-col gap-4">
      <div>
        <h3 className="font-headline-sm text-headline-sm text-primary">{t('consent.profileTitle')}</h3>
        <p className="text-on-surface-variant text-body-md mt-1">
          {profile.terms_accepted_at
            ? t('consent.acceptedOn', { date: formatDateTime(profile.terms_accepted_at) })
            : t('consent.notAccepted')}{' '}
          <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
            {t('consent.readPrivacy')}
          </Link>
        </p>
      </div>
      <MarketingConsentSwitch initial={profile.marketing_opt_in} />
    </div>
  )
}
