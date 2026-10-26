import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'
import { needsConsent } from '@/lib/consent'
import { getCurrentConsentVersion } from '@/lib/data/legal'
import { getConsentLegalProps } from '@/lib/legal/props'
import { sanitizeNext } from '@/lib/auth/sanitize'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { ConsentForm } from './ConsentForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getLocale())
  return { title: `${t('consent.title')} — Zenzero Hotel` }
}

/**
 * Phase 61 — one-time PDPA consent page. Reached from the proxy (page loads
 * under /bookings and /account) and from the booking actions, always with
 * `?next=` pointing back to where the customer was going.
 */
export default async function ConsentPage(props: PageProps<'/consent'>) {
  const searchParams = await props.searchParams
  const next = sanitizeNext(typeof searchParams.next === 'string' ? searchParams.next : '/')

  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/consent?next=${next}`)}`)
  if (session.role !== 'user') redirect(roleHomePath(session.role))
  // Already accepted the current version — never show the page twice.
  if (!needsConsent(session, await getCurrentConsentVersion())) redirect(next)

  const locale = await getLocale()
  const t = getT(locale)
  const legal = await getConsentLegalProps(locale)

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-xl mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-8 md:p-10">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon name="verified_user" className="text-primary" />
              <h1 className="font-display text-2xl font-bold text-primary">{t('consent.title')}</h1>
            </div>
            <p className="text-body-md text-on-surface-variant mb-6">
              {session.termsVersion ? t('consent.introUpdated') : t('consent.intro')}
            </p>
            <ConsentForm next={next} legal={legal} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
