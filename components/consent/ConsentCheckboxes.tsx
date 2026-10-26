'use client'

/**
 * Phase 61 — PDPA consent checkboxes, shared by the register form and the
 * /consent page. Posts `accept_terms` (required) and `marketing_opt_in`
 * (optional, never pre-ticked) with the surrounding form.
 *
 * Phase 62 — also posts `legal_version` (the version shown here; the actions
 * refuse a stale one), and once the admin has published PDFs the "read"
 * links open them in a modal instead of a new tab.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/useT'
import { LegalDocModal } from '@/components/legal/LegalDocModal'
import type { ConsentLegalProps } from '@/lib/legal/props'

const linkClass = 'text-primary underline-offset-2 hover:underline'

export function ConsentCheckboxes({
  defaultMarketing = false,
  legal,
}: {
  defaultMarketing?: boolean
  legal: ConsentLegalProps
}) {
  const t = useT()
  const [openDoc, setOpenDoc] = useState<'terms' | 'privacy' | null>(null)

  const docLink = (kind: 'terms' | 'privacy', src: string | null, label: string) =>
    src ? (
      <button type="button" onClick={() => setOpenDoc(kind)} className={linkClass}>
        {label}
      </button>
    ) : (
      <Link href={`/${kind}`} target="_blank" className={linkClass}>
        {label}
      </Link>
    )

  const openSrc = openDoc === 'terms' ? legal.termsSrc : openDoc === 'privacy' ? legal.privacySrc : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-body-md">
      <input type="hidden" name="legal_version" value={legal.version} />
      <label className="flex items-start gap-2 cursor-pointer text-on-surface">
        <input type="checkbox" name="accept_terms" required className="mt-1 h-4 w-4 accent-primary" />
        <span>
          {t('consent.acceptTerms')} <span className="text-error">*</span>
        </span>
      </label>
      <p className="ml-6 -mt-1 text-caption text-on-surface-variant">
        {docLink('terms', legal.termsSrc, t('consent.readTerms'))}
        {' · '}
        {docLink('privacy', legal.privacySrc, t('consent.readPrivacy'))}
      </p>
      <label className="flex items-start gap-2 cursor-pointer text-on-surface">
        <input
          type="checkbox"
          name="marketing_opt_in"
          defaultChecked={defaultMarketing}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <span>
          {t('consent.marketing')}{' '}
          <span className="text-on-surface-variant">{t('consent.marketingHint')}</span>
        </span>
      </label>
      {openDoc && openSrc && (
        <LegalDocModal
          open
          onClose={() => setOpenDoc(null)}
          title={openDoc === 'terms' ? t('consent.readTerms') : t('consent.readPrivacy')}
          src={openSrc}
          downloadName={openDoc}
        />
      )}
    </div>
  )
}
