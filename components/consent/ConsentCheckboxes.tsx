'use client'

/**
 * Phase 61 — PDPA consent checkboxes, shared by the register form and the
 * /consent page. Posts `accept_terms` (required) and `marketing_opt_in`
 * (optional, never pre-ticked) with the surrounding form.
 */
import Link from 'next/link'
import { useT } from '@/lib/i18n/useT'

export function ConsentCheckboxes({ defaultMarketing = false }: { defaultMarketing?: boolean }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-body-md">
      <label className="flex items-start gap-2 cursor-pointer text-on-surface">
        <input type="checkbox" name="accept_terms" required className="mt-1 h-4 w-4 accent-primary" />
        <span>
          {t('consent.acceptTerms')} <span className="text-error">*</span>
        </span>
      </label>
      <p className="ml-6 -mt-1 text-caption text-on-surface-variant">
        <Link href="/terms" target="_blank" className="text-primary underline-offset-2 hover:underline">
          {t('consent.readTerms')}
        </Link>
        {' · '}
        <Link href="/privacy" target="_blank" className="text-primary underline-offset-2 hover:underline">
          {t('consent.readPrivacy')}
        </Link>
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
    </div>
  )
}
