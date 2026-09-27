import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getRoomTypeById } from '@/lib/data/rooms'
import { getTempBookingById } from '@/lib/data/bookings'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { TransactionalHeader } from '@/components/layout/TransactionalHeader'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { BookingForm } from './BookingForm'
import { calculateNights } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage(props: PageProps<'/bookings/new'>) {
  const searchParams = await props.searchParams
  const bookingIdParam =
    typeof searchParams.bookingId === 'string' ? searchParams.bookingId : null

  // Check auth first — both paths (bookingId + legacy) require login.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    if (bookingIdParam) {
      redirect(`/login?next=/bookings/new?bookingId=${bookingIdParam}`)
    }
    redirect('/login?next=/bookings/new')
  }

  // Phase 42 — primary path: user came from /rooms/[id] "ยืนยันการจอง"
  // button, which already created a temp_pending booking. Load it via
  // getTempBookingById (runs lazy expiry first → stale rows flip to 'expired').
  if (bookingIdParam) {
    const existing = await getTempBookingById(bookingIdParam, user.id)

    // None of: not found / not owned / not in temp_pending state / expired
    // → bounce to /rooms so the user can start fresh.
    if (!existing) {
      redirect('/rooms')
    }
    if (existing.status !== 'temp_pending') {
      if (existing.status === 'expired') {
        redirect('/rooms?error=tempExpired')
      }
      if (existing.status === 'confirmed') {
        // Already completed — go to detail page instead.
        redirect(`/bookings/${existing.id}`)
      }
      redirect('/rooms')
    }

    // Load the room + seasonal quote for the existing booking dates.
    const room = await getRoomTypeById(existing.room_type_id)
    if (!room || !room.is_active) notFound()

    const seasonalRates = await getActiveSeasonalRatesForRange({
      roomTypeId: room.id,
      checkIn: existing.check_in,
      checkOut: existing.check_out,
    })
    const quote = quoteStay({
      roomTypeId: room.id,
      basePrice: room.base_price,
      checkIn: existing.check_in,
      checkOut: existing.check_out,
      rates: seasonalRates,
    })
    const minNightsBlocked = violatesMinNights(quote, seasonalRates)
    const pricingSettings = await getPricingConstants()

    return (
      <>
        <TopNavBar />
        <main className="flex-1 bg-background">
          <TransactionalHeader backHref={`/rooms/${room.slug}`} />
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-8">
            <h1 className="font-display text-3xl text-primary mb-8">ยืนยันข้อมูลการจอง</h1>

            <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
              <BookingForm
                existingBooking={existing}
                room={{
                  id: room.id,
                  slug: room.slug,
                  name: room.name,
                  name_th: room.name_th,
                  hero_image_key: room.hero_image_key,
                  base_price: room.base_price,
                }}
                quote={quote}
                minNightsBlocked={minNightsBlocked}
                settings={pricingSettings}
              />
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Legacy path — search bar redirects here with roomId/checkIn/checkOut/guests.
  // DEPRECATED in Phase 42 but kept for backward-compat with any open tabs.
  const roomId = typeof searchParams.roomId === 'string' ? searchParams.roomId : null
  const checkIn = typeof searchParams.checkIn === 'string' ? searchParams.checkIn : null
  const checkOut = typeof searchParams.checkOut === 'string' ? searchParams.checkOut : null
  const guests = searchParams.guests ? parseInt(String(searchParams.guests), 10) : 1

  if (!roomId || !checkIn || !checkOut) {
    redirect('/rooms')
  }

  const room = await getRoomTypeById(roomId)
  if (!room || !room.is_active) notFound()

  const nights = calculateNights(checkIn, checkOut)
  if (nights === 0) {
    redirect(`/rooms/${room.slug}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const seasonalRates = await getActiveSeasonalRatesForRange({
    roomTypeId: room.id,
    checkIn,
    checkOut,
  })
  const quote = quoteStay({
    roomTypeId: room.id,
    basePrice: room.base_price,
    checkIn,
    checkOut,
    rates: seasonalRates,
  })
  const minNightsBlocked = violatesMinNights(quote, seasonalRates)
  const pricingSettings = await getPricingConstants()

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <TransactionalHeader backHref={`/rooms/${room.slug}`} />
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-8">
          <h1 className="font-display text-3xl text-primary mb-8">ยืนยันข้อมูลการจอง</h1>

          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
            <BookingForm
              room={{
                id: room.id,
                slug: room.slug,
                name: room.name,
                name_th: room.name_th,
                hero_image_key: room.hero_image_key,
                base_price: room.base_price,
              }}
              checkIn={checkIn}
              checkOut={checkOut}
              guests={guests}
              profile={{
                fullName: profile?.full_name ?? user.user_metadata?.full_name ?? '',
                email: user.email ?? '',
                phone: profile?.phone ?? user.user_metadata?.phone ?? '',
              }}
              quote={quote}
              minNightsBlocked={minNightsBlocked}
              settings={pricingSettings}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}