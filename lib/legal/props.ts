import type { Locale } from '@/lib/i18n/config'
import { getCurrentLegalVersion } from '@/lib/data/legal'
import { consentVersionOf } from '@/lib/consent'
import { legalDocFor, legalFileUrl } from './docs'

/**
 * Phase 62 — what the consent checkboxes need: the version the visitor is
 * shown (posted back as `legal_version`) and the PDFs to open. The srcs are
 * null while nothing is published (links then go to the JSX /terms, /privacy).
 */
export interface ConsentLegalProps {
  version: string
  termsSrc: string | null
  privacySrc: string | null
}

export async function getConsentLegalProps(locale: Locale): Promise<ConsentLegalProps> {
  const row = await getCurrentLegalVersion()
  return {
    version: consentVersionOf(row),
    termsSrc: row ? legalFileUrl(legalDocFor('terms', locale), row.id) : null,
    privacySrc: row ? legalFileUrl(legalDocFor('privacy', locale), row.id) : null,
  }
}
