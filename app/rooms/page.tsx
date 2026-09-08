import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { FilterSidebarServer } from '@/components/search/FilterSidebarServer'
import { FilterChips } from '@/components/search/FilterChips'
import { SearchBar } from '@/components/search/SearchBar'
import { FloorGroupSection } from '@/components/room/FloorGroupSection'
import { searchRooms } from '@/lib/data/rooms'
import type { SearchFilters } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { getTomorrowLocalIso, addDaysLocalIso } from '@/lib/dates'

// Server-render on demand (Supabase data + searchParams)
export const dynamic = 'force-dynamic'

export default async function RoomsPage(props: PageProps<'/rooms'>) {
  const searchParams = await props.searchParams
  const locale = await getLocale()
  const t = getT(locale)

  // Phase 27 — when the user arrives at /rooms without explicit dates
  // (e.g. via navbar, homepage CTAs, about/contact links, 404), fall
  // back to tomorrow / tomorrow+1 so the availability filter
  // (filterByAvailability in lib/data/supabase-rooms.ts) always runs.
  // Without this, every public entry point showed all room types —
  // including ones already booked for the next available dates.
  // Defaults match the compact SearchBar's visual defaults so the
  // page's filter state and the UI's date inputs stay in sync.
  const todayPlus1 =
    typeof searchParams.checkin === 'string' && searchParams.checkin
      ? searchParams.checkin
      : getTomorrowLocalIso()
  const todayPlus2 =
    typeof searchParams.checkout === 'string' &&
    searchParams.checkout &&
    searchParams.checkout > todayPlus1
      ? searchParams.checkout
      : addDaysLocalIso(todayPlus1, 1)

  const filters: SearchFilters = {
    checkin: todayPlus1,
    checkout: todayPlus2,
    guests: searchParams.guests ? parseInt(String(searchParams.guests), 10) : undefined,
    type:
      typeof searchParams.type === 'string'
        ? (searchParams.type as SearchFilters['type'])
        : 'all',
    floor:
      typeof searchParams.floor === 'string'
        ? searchParams.floor === 'all'
          ? 'all'
          : parseInt(searchParams.floor, 10)
        : 'all',
    priceRange:
      typeof searchParams.priceRange === 'string'
        ? (searchParams.priceRange as SearchFilters['priceRange'])
        : 'all',
  }

  const { rooms, total } = await searchRooms(filters)

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        {/* Top search bar (compact) */}
        <section className="bg-surface-container-low border-b border-outline-variant py-6">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop)">
            <SearchBar
              variant="compact"
              defaultCheckin={filters.checkin}
              defaultCheckout={filters.checkout}
              defaultGuests={filters.guests}
            />
          </div>
        </section>

        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            {/* Sidebar (filters) */}
            <div className="flex flex-col gap-6">
              <FilterSidebarServer />
            </div>

            {/* Results */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl text-primary">{t('roomsList.title')}</h1>
                <span className="text-body-md text-on-surface-variant">
                  {t('roomsList.resultsCount', { count: total })}
                </span>
              </div>

              <FilterChips />

              <FloorGroupSection rooms={rooms} locale={locale} searchParams={searchParams} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
