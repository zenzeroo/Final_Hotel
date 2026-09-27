import { notFound } from 'next/navigation'
import { getRoomBySlug } from '@/lib/data/rooms'
import { getPricingConstants } from '@/lib/data/manager'
import { getSession } from '@/lib/supabase/getSession'
import { bedTypeLabel } from '@/lib/format/bedType'
import { roomTypeLabel } from '@/lib/format/roomType'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { RoomGallery } from '@/components/room/RoomGallery'
import { AmenityGrid } from '@/components/room/AmenityGrid'
import { RatingStars } from '@/components/room/RatingStars'
import { BookingWidget } from '@/components/room/BookingWidget'
import { ReviewList } from '@/components/room/ReviewList'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { SearchBar } from '@/components/search/SearchBar'

// Server-render on demand (Supabase data + dynamic params)
export const dynamic = 'force-dynamic'

export default async function RoomDetailPage(props: PageProps<'/rooms/[id]'>) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const locale = await getLocale()
  const t = getT(locale)
  const isEn = locale === 'en'
  const room = await getRoomBySlug(id)
  // Phase parity — pass live tax + resort fee to the BookingWidget so its
  // preview totals match `/bookings/new`. Without this, the widget falls
  // back to the hardcoded DEFAULT_PRICING (0.07 / 150).
  const pricingSettings = await getPricingConstants()

  // Forward the dates the user picked in /rooms so the BookingWidget
  // pre-fills instead of resetting to defaults. Casing is lowercase
  // `checkin/checkout` to match the SearchBar writer (see
  // components/search/SearchBar.tsx). `guests` is no longer read by the
  // widget — it always reserves the room's max capacity — so the URL
  // param from the /rooms SearchBar is ignored on this page.
  const defaultCheckIn = typeof searchParams.checkin === 'string' ? searchParams.checkin : undefined
  const defaultCheckOut = typeof searchParams.checkout === 'string' ? searchParams.checkout : undefined

  // Read auth state server-side so the BookingWidget can show a login
  // prompt modal when the user clicks "ยืนยันการจอง" without an account,
  // instead of bouncing them through /bookings/new → /login. Mirrors the
  // pattern used by <TopNavBar> (passes isAuthed down to client children).
  const session = await getSession()
  const isAuthed = Boolean(session)

  // Phase 40 — when /bookings/new redirected back with ?error=held,
  // show a Thai/EN banner explaining the room was just taken by another
  // user. The booking_holds TTL is 10 minutes so the user can retry.
  const holdError = searchParams.error === 'held'

  if (!room) {
    notFound()
  }

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-10">
          {holdError && (
            <div
              role="alert"
              className="mb-6 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error"
            >
              {isEn
                ? 'This room was just reserved by another guest. Please try again in a few minutes — the hold expires automatically.'
                : 'ห้องนี้เพิ่งถูกจองหรือถูกระงับชั่วคราวโดยผู้ใช้อื่น กรุณาลองใหม่ในอีกสักครู่ (การถือครองจะหมดอายุภายใน 10 นาที)'}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
            {/* Main content */}
            <article className="flex flex-col gap-12">
              {/* Gallery + overlay SearchBar — relative wrapper so the
                  SearchBar floats over the bottom edge of the gallery.
                  variant="overlay" auto-navigates to /rooms on date change. */}
              <div className="relative">
                <RoomGallery room={room} />
                <div className="absolute inset-x-0 bottom-0 z-20 px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) pb-3 md:pb-4 pointer-events-none">
                  <div className="max-w-(--spacing-container-max) mx-auto pointer-events-auto">
                    <SearchBar
                      variant="overlay"
                      defaultCheckin={defaultCheckIn}
                      defaultCheckout={defaultCheckOut}
                    />
                  </div>
                </div>
              </div>

              {/* Title block */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h1 className="font-display text-3xl md:text-4xl text-primary">
                    {/* Phase X — locale-aware title (TH when available + locale=th) */}
                    {locale === 'th' && room.name_th ? room.name_th : room.name}
                  </h1>
                  <RatingStars value={room.rating_avg} count={room.rating_count} size={20} />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-md text-on-surface-variant">
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon name="hotel" size={18} />
                    {roomTypeLabel(room.type, locale)}
                  </span>
                  {room.size_sqm && (
                    <span className="inline-flex items-center gap-2">
                      <MaterialIcon name="square_foot" size={18} />
                      {room.size_sqm} {t('roomDetail.size')}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon name="group" size={18} />
                    {t('roomDetail.maxGuests', { count: room.max_guests })}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon name="bed" size={18} />
                    {bedTypeLabel(room.bed_type, locale)}
                  </span>
                  {room.view_label && (
                    <span className="inline-flex items-center gap-2">
                      <MaterialIcon name="landscape" size={18} />
                      {t('roomDetail.view')}:{' '}
                      {/* Phase X — locale-aware view label (TH when available + locale=th) */}
                      {locale === 'th' && room.view_label_th ? room.view_label_th : room.view_label}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <MaterialIcon name="stairs" size={18} />
                    {t('roomDetail.floor')} {room.floor}
                  </span>
                </div>
              </div>

              {/* Amenities */}
              <section>
                <h2 className="font-display text-2xl text-primary mb-4">{t('roomDetail.amenities')}</h2>
                <AmenityGrid amenitySlugs={room.amenities} />
              </section>

              {/* Description */}
              <section>
                <h2 className="font-display text-2xl text-primary mb-4">{t('roomDetail.description')}</h2>
                <p className="text-body-lg text-on-surface leading-relaxed">
                  {/* Phase X — locale-aware description (TH when available + locale=th) */}
                  {locale === 'th' && room.description_th ? room.description_th : room.description}
                </p>
              </section>

              {/* Reviews */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-2xl text-primary">{t('roomDetail.reviews')}</h2>
                  <span className="inline-flex items-center gap-2 text-body-md text-on-surface-variant">
                    <RatingStars value={room.rating_avg} size={16} showValue={true} />
                    <span className="text-caption">({t('roomDetail.reviewCount', { count: room.rating_count })})</span>
                  </span>
                </div>
                <ReviewList roomTypeId={room.id} />
              </section>
            </article>

            {/* Booking widget (Phase 2) */}
            <BookingWidget
              room={room}
              settings={pricingSettings}
              defaultCheckIn={defaultCheckIn}
              defaultCheckOut={defaultCheckOut}
              isAuthed={isAuthed}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export async function generateMetadata(props: PageProps<'/rooms/[id]'>) {
  const { id } = await props.params
  const locale = await getLocale()
  const t = getT(locale)
  const room = await getRoomBySlug(id)
  if (!room) return { title: `${t('roomDetail.roomNotFound')} | Zenzero Hotel` }
  return {
    // Phase X — locale-aware title (TH when available + locale=th)
    title:
      locale === 'th' && room.name_th
        ? `${room.name_th} | Zenzero Hotel`
        : `${room.name} | Zenzero Hotel`,
    description:
      // Phase X — locale-aware SEO meta (TH when available + locale=th)
      locale === 'th' && room.short_desc_th ? room.short_desc_th : room.short_desc,
  }
}
