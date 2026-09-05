import { getSession } from '@/lib/supabase/getSession'
import { getUserBookings } from '@/lib/data/bookings'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { BookingHistory } from './BookingHistory'
import { EmptyState } from '@/components/feedback/EmptyState'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function BookingsHistoryPage() {
  const session = await getSession()
  const t = getT(await getLocale())

  if (!session) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-body-lg text-on-surface-variant">{t('error.unauthorized')}</p>
        </main>
        <Footer />
      </>
    )
  }

  const bookings = await getUserBookings(session.id)

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
            <BookingHistory bookings={bookings} />
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
