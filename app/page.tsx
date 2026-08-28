import Link from 'next/link'
import { getFeaturedRooms } from '@/lib/data/rooms'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/landing/HeroSection'
import { RoomCard } from '@/components/room/RoomCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

// Server-render on demand (Supabase data, no static prerender)
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const rooms = await getFeaturedRooms()

  return (
    <>
      <TopNavBar />
      <main className="flex-1">
        <HeroSection />

        {/* Featured Rooms */}
        <section className="pt-40 pb-20 md:pt-48 md:pb-24">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-label-md text-secondary font-semibold uppercase tracking-wider">
                  แนะนำ
                </span>
                <h2 className="font-display text-3xl md:text-4xl text-primary mt-2">
                  ห้องพักแนะนำ
                </h2>
              </div>
              <Link
                href="/rooms"
                className="hidden md:inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider hover:text-secondary transition-colors"
              >
                ดูห้องพักทั้งหมด
                <MaterialIcon name="arrow_forward" size={18} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} variant="featured" />
              ))}
            </div>

            <div className="md:hidden mt-8 text-center">
              <Link
                href="/rooms"
                className="inline-flex items-center gap-2 text-label-md text-primary font-semibold uppercase tracking-wider"
              >
                ดูห้องพักทั้งหมด
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
