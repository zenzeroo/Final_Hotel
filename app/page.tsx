import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getFeaturedRooms } from '@/lib/data/rooms'
import { getSession } from '@/lib/supabase/getSession'
import { roleHomePath } from '@/lib/supabase/roles'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { HeroCarousel } from '@/components/landing/HeroCarousel'
import { RoomCard } from '@/components/room/RoomCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { roomTypeLabel } from '@/lib/format/roomType'
import { getActiveHeroSlides } from '@/lib/data/landing'
import type { ResolvedHeroSlide } from '@/lib/data/types'

// Server-render on demand (Supabase data, no static prerender)
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Phase 27 — defense-in-depth. proxy.ts already redirects staff away
  // from `/` (lib/supabase/proxy.ts staff-redirect branch). If proxy
  // is ever bypassed (misconfigured matcher, internal navigation in
  // tests, etc.) this server-side guard still sends staff to their
  // own dashboard. `getSession()` is uncached → always reflects the
  // current Supabase auth state.
  const session = await getSession()
  if (session && session.role !== 'user') {
    redirect(roleHomePath(session.role))
  }

  const locale = await getLocale()
  const t = getT(locale)
  const [rooms, slides] = await Promise.all([getFeaturedRooms(), getActiveHeroSlides()])
  // Without admin slides the carousel shows the featured rooms' photos.
  const heroSlides: ResolvedHeroSlide[] =
    slides.length > 0
      ? slides
      : rooms.map((room, i) => ({
          id: room.id,
          imageKey: room.hero_image_key,
          sourceType: 'room_type',
          displayOrder: i,
          isActive: true,
          heading: null,
          subheading: null,
          badge: null,
        }))

  return (
    <>
      <TopNavBar />
      <main className="flex-1">
        {/* Phase 43 — admin-managed hero carousel (room photos when no slides are set). */}
        <HeroCarousel
          slides={heroSlides}
          defaultHeading={t('home.heroTitle')}
          defaultSubheading={t('home.heroSubheading')}
        />

        {/* Featured Rooms */}
        <section className="pt-40 pb-20 md:pt-48 md:pb-24">
          <div className="page-x">
            <div className="flex items-end justify-between mb-10">
              <h2 className="font-display text-3xl md:text-4xl text-primary">
                {t('home.featuredRooms')}
              </h2>
              <Link
                href="/rooms"
                className="group hidden md:inline-flex items-center gap-2 text-body-md text-primary font-semibold hover:bg-primary-fixed px-2 py-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('roomsList.title')}
                <MaterialIcon
                  name="arrow_forward"
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  locale={locale}
                  typeLabel={roomTypeLabel(room.type, locale)}
                  maxGuestsLabel={t('roomCard.maxGuests', { count: room.max_guests })}
                />
              ))}
            </div>

            <div className="md:hidden mt-8 text-center">
              <Link
                href="/rooms"
                className="inline-flex items-center gap-2 text-body-md text-primary font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('roomsList.title')}
                <MaterialIcon name="arrow_forward" size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
