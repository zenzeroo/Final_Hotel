import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveSeasonalRatesForRange, getPricingConstants } from '@/lib/data/manager'
import { getRoomTypeById } from '@/lib/data/rooms'
import { quoteStay, violatesMinNights } from '@/lib/pricing/seasons'
import { TransactionalHeader } from '@/components/layout/TransactionalHeader'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { BookingForm } from './BookingForm'
import { calculateNights } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage(props: PageProps<'/bookings/new'>) {
  const searchParams = await props.searchParams
  const roomId = typeof searchParams.roomId === 'string' ? searchParams.roomId : null
  const checkIn = typeof searchParams.checkIn === 'string' ? searchParams.checkIn : null
  const checkOut = typeof searchParams.checkOut === 'string' ? searchParams.checkOut : null
  const guests = searchParams.guests ? parseInt(String(searchParams.guests), 10) : 1

  // Validate params
  if (!roomId || !checkIn || !checkOut) {
    redirect('/rooms')
  }

  // Check auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/bookings/new?roomId=${roomId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)
  }

  // Get room (filter out inactive so a crafted URL can't start a booking
  // for a hidden room_type).
  const room = await getRoomTypeById(roomId)
  if (!room || !room.is_active) notFound()

  const nights = calculateNights(checkIn, checkOut)
  if (nights === 0) {
    redirect(`/rooms/${room.slug}`)
  }

  // Get profile (for pre-fill)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  // Phase 8 — fetch seasonal rates and compute the per-night quote server-side
  // so the user sees the actual price (with applied seasonal rates) before submit.
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

  // Live tax + resort fee for the client preview. Server createBooking
  // reads the same helper (see app/actions/booking.ts).
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