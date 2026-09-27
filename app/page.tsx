import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getFeaturedRooms } from '@/lib/data/rooms'
import { getSession } from '@/lib/supabase/getSession'
import { roleHomePath } from '@/lib/supabase/roles'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/landing/HeroSection'
import { HeroCarousel } from '@/components/landing/HeroCarousel'
import { RoomCard } from '@/components/room/RoomCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { roomTypeLabel } from '@/lib/format/roomType'
import { getActiveHeroSlides } from '@/lib/data/landing'

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

  return (
    <>
      <TopNavBar />
      <main className="flex-1">
        {/*
          Phase 43 — admin-managed hero carousel. If at least 1 active
          slide exists, render the carousel; otherwise fall back to the
          static HeroSection so a fresh install with no slides configured
          yet still has a homepage.
         */}
        {slides.length > 0 ? (
          <HeroCarousel
            slides={slides}
            defaultLabel={t('home.heroLabel')}
            defaultHeading={t('home.heroTitle')}
            defaultSubheading={t('home.heroSubheading')}
          />
        ) : (
          <HeroSection />
        )}

        {/* Featured Rooms */}
        <section className="pt-40 pb-20 md:pt-48 md:pb-24">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-label-md text-secondary font-semibold uppercase tracking-wider">
                  {t('home.featuredRooms')}
                </span>
                <h2 className="font-display text-3xl md:text-4xl text-primary mt-2">
                  {t('home.featuredRooms')}
                </h2>
              </div>
              <Link
                href="/rooms"
                className="group hidden md:inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider hover:bg-primary-fixed px-2 py-1 rounded transition-colors duration-200"
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
                  variant="featured"
                  typeLabel={roomTypeLabel(room.type, locale)}
                  maxGuestsLabel={t('roomCard.maxGuests', { count: room.max_guests })}
                />
              ))}
            </div>

            <div className="md:hidden mt-8 text-center">
              <Link
                href="/rooms"
                className="inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider"
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
