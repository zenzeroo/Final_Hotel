import type { Locale } from '@/lib/i18n/config'

/**
 * Phase 62 — the four admin-uploaded legal PDFs (privacy / terms × TH / EN).
 * Plain module (no Next.js / Supabase imports) so the proxy and unit tests
 * can use it.
 */
export const LEGAL_DOCS = ['privacy-th', 'privacy-en', 'terms-th', 'terms-en'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

/** R2 key per doc; null = no file (draft slot empty / not uploaded yet). */
export type LegalKeys = Record<LegalDoc, string | null>

/** Column holding each doc's R2 key in `legal_versions` and `legal_draft`. */
export const LEGAL_DOC_COLUMN = {
  'privacy-th': 'privacy_th_key',
  'privacy-en': 'privacy_en_key',
  'terms-th': 'terms_th_key',
  'terms-en': 'terms_en_key',
} as const satisfies Record<LegalDoc, string>

export function legalDocFor(kind: 'privacy' | 'terms', locale: Locale): LegalDoc {
  return `${kind}-${locale}`
}

/** Same-origin URL of a doc's PDF (app/legal-files/[doc]/route.ts). */
export function legalFileUrl(doc: LegalDoc, version: string | 'draft'): string {
  return `/legal-files/${doc}?v=${encodeURIComponent(version)}`
}

export function isLegalDoc(v: string): v is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(v)
}
