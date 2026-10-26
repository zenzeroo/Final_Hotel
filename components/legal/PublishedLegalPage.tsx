import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { formatBangkokDate } from '@/lib/dates'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import type { LegalVersionRow } from '@/lib/legal/current'
import { legalDocFor, legalFileUrl } from '@/lib/legal/docs'
import { PdfViewerLazy } from './PdfViewerLazy'

/**
 * Phase 62 — /privacy or /terms once the admin has published PDFs: the
 * page header, the publish date and the PDF for the visitor's language.
 */
export function PublishedLegalPage({
  kind,
  row,
  locale,
  eyebrow,
  title,
}: {
  kind: 'privacy' | 'terms'
  row: LegalVersionRow
  locale: Locale
  eyebrow: string
  title: string
}) {
  const t = getT(locale)
  const doc = legalDocFor(kind, locale)
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-4xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">{eyebrow}</span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-2">{title}</h1>
            <p className="text-caption text-on-surface-variant mb-8">
              {t('legal.updatedAt', { date: formatBangkokDate(row.publishedAt) })}
            </p>
            <PdfViewerLazy src={legalFileUrl(doc, row.id)} downloadName={doc} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
