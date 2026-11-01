import { formatBangkokDate } from '@/lib/dates'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import type { LegalVersionRow } from '@/lib/legal/current'
import { legalDocFor, legalFileUrl } from '@/lib/legal/docs'
import { LegalPageShell } from './LegalPageShell'
import { PdfViewerLazy } from './PdfViewerLazy'

/**
 * Phase 62 — /privacy or /terms once the admin has published PDFs: the
 * shared legal frame with the publish date and the PDF for the visitor's
 * language.
 */
export function PublishedLegalPage({
  kind,
  row,
  locale,
  title,
}: {
  kind: 'privacy' | 'terms'
  row: LegalVersionRow
  locale: Locale
  title: string
}) {
  const t = getT(locale)
  const doc = legalDocFor(kind, locale)
  return (
    <LegalPageShell
      kind={kind}
      locale={locale}
      title={title}
      updated={t('legal.updatedAt', { date: formatBangkokDate(row.publishedAt) })}
    >
      <PdfViewerLazy src={legalFileUrl(doc, row.id)} downloadName={doc} />
    </LegalPageShell>
  )
}
