import type { Metadata } from 'next'
import { getSession } from '@/lib/supabase/getSession'
import { getUserBookings, getUserRefundRequests } from '@/lib/data/bookings'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { BookingHistory } from './BookingHistory'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { getTodayBangkok } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * Phase 53 — render `robots: { index: false, follow: false }` when the
 * visitor is not logged in. The page title stays the same as the
 * logged-in view; only the robots directive differs. This keeps the
 * "please sign in" placeholder out of Google search results without
 * adding a separate "log in" page to the index.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = getT(locale)
  const session = await getSession()
  if (!session) {
    return {
      title: t('bookings.title'),
      robots: { index: false, follow: false },
    }
  }
  return { title: t('bookings.title') }
}

export default async function BookingsHistoryPage() {
  const session = await getSession()
  const t = getT(await getLocale())

  // Phase 53 — logged-out visitors see a styled "please sign in"
  // placeholder card instead of being auto-redirected. The proxy
  // (lib/supabase/proxy.ts) and the (booking) layout no longer block
  // this path; the page owns the UX. No booking queries are run for
  // anonymous visitors (RLS is the real protection, but we don't
  // even attempt the call to keep the page fast + avoid any chance
  // of metadata leakage).
  if (!session) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 bg-background">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-10">
            <h1 className="font-display text-3xl text-primary mb-2">{t('bookings.title')}</h1>
            <p className="text-body-md text-on-surface-variant mb-8">
              {t('bookings.noBookingsHint')}
            </p>
            <EmptyState
              icon="lock"
              title={t('bookings.loginRequired.title')}
              description={t('bookings.loginRequired.body')}
              ctaLabel={t('bookings.loginRequired.goToLogin')}
              ctaHref={`/login?next=${encodeURIComponent('/bookings')}`}
            />
            <div className="flex justify-center mt-4">
              <Button variant="secondary" href="/rooms">
                {t('bookings.loginRequired.browseAsGuest')}
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const [bookings, refundRequests] = await Promise.all([
    getUserBookings(session.id),
    getUserRefundRequests(session.id),
  ])

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-10">
          <h1 className="font-display text-3xl text-primary mb-2">{t('bookings.title')}</h1>
          <p className="text-body-md text-on-surface-variant mb-8">
            {bookings.length === 0
              ? t('bookings.noBookings')
              : t('bookings.noBookingsHint')}
          </p>

          {bookings.length === 0 ? (
            <EmptyState
              icon="bookmark"
              title={t('bookings.noBookings')}
              description={t('bookings.noBookingsHint')}
              ctaLabel={t('bookings.browseRooms')}
              ctaHref="/rooms"
            />
          ) : (
            <BookingHistory
              bookings={bookings}
              refundRequests={refundRequests}
              today={getTodayBangkok()}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
