import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

/**
 * Shared frame for /terms and /privacy (built-in text or the published PDF):
 * title, intro and update date, then a sticky side panel (contents, the
 * other legal document, contact) beside the document in a white panel (4:8).
 */
export function LegalPageShell({
  kind,
  locale,
  title,
  intro,
  updated,
  sections,
  children,
}: {
  kind: 'terms' | 'privacy'
  locale: Locale
  title: string
  intro?: React.ReactNode
  updated: string
  /** Section list for the contents panel and the document body. */
  sections?: LegalSection[]
  /** Document body when it isn't a section list (the published PDF). */
  children?: React.ReactNode
}) {
  const t = getT(locale)
  const other = kind === 'terms' ? { href: '/privacy', label: t('footer.privacy') } : { href: '/terms', label: t('footer.terms') }
  const link =
    'text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <header className="page-x pt-10 md:pt-14 pb-10 md:pb-12">
          <h1 className="font-display text-[36px] md:text-[48px] leading-[1.15] tracking-[-0.01em] text-primary">{title}</h1>
          {intro && <p className="mt-4 max-w-[62ch] text-body-lg leading-[1.75] text-on-surface">{intro}</p>}
          <p className="mt-4 text-[14px] text-on-surface-variant">{updated}</p>
        </header>

        <div className="page-x pb-16 md:pb-20 grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-6 lg:gap-10 items-start">
          <aside className="lg:sticky lg:top-24 bg-surface-container-low rounded-2xl p-6 flex flex-col gap-6 text-body-md">
            {sections && sections.length > 0 && (
              <nav aria-labelledby="legal-contents">
                <h2 id="legal-contents" className="text-[14px] font-semibold text-on-surface-variant mb-3">
                  {t('legal.onThisPage')}
                </h2>
                <ol className="flex flex-col gap-2">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className={`${link} block leading-snug`}>{s.title}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="flex flex-col gap-2">
              <h2 className="text-[14px] font-semibold text-on-surface-variant">{t('legal.related')}</h2>
              <Link href={other.href} className={link}>{other.label}</Link>
              <Link href="/contact" className={link}>{t('legal.questions')}</Link>
            </div>
          </aside>

          <article className="bg-surface-container-lowest rounded-2xl p-6 md:p-10 min-w-0">
            {sections ? (
              <div className="flex flex-col gap-10 max-w-[72ch]">
                {sections.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-24">
                    <h2 className="font-display text-xl md:text-2xl leading-[1.3] text-primary mb-4">{s.title}</h2>
                    <div className="flex flex-col gap-3 text-body-md leading-[1.8] text-on-surface [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:marker:text-primary">
                      {s.body}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              children
            )}
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
