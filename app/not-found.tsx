import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

// app/not-found.tsx — Next.js convention for unmatched routes.
// Server Component (no 'use client') so the layout wrapper still renders.
export default async function NotFound() {
  const t = getT(await getLocale())
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-24 md:py-32">
          <div className="max-w-xl mx-auto text-center">
            <p className="font-display text-7xl md:text-8xl text-primary font-bold">
              404
            </p>
            <h1 className="font-display text-2xl md:text-3xl text-on-surface mt-4 mb-3">
              {t('notFound.title')}
            </h1>
            <p className="text-body-md text-on-surface-variant mb-8">
              {t('notFound.description')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-secondary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
              >
                <MaterialIcon name="home" size={18} />
                {t('notFound.goHome')}
              </Link>
              <Link
                href="/rooms"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-outline-variant text-primary font-semibold text-label-md uppercase tracking-wider hover:bg-surface-container-low transition-colors"
              >
                <MaterialIcon name="hotel" size={18} />
                {t('nav.rooms')}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
