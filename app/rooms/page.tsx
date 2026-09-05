import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { FilterSidebarServer } from '@/components/search/FilterSidebarServer'
import { FilterChips } from '@/components/search/FilterChips'
import { SearchSummaryCard } from '@/components/search/SearchSummaryCard'
import { SearchBar } from '@/components/search/SearchBar'
import { FloorGroupSection } from '@/components/room/FloorGroupSection'
import { searchRooms } from '@/lib/data/rooms'
import type { SearchFilters } from '@/lib/data/types'

// Server-render on demand (Supabase data + searchParams)
export const dynamic = 'force-dynamic'

export default async function RoomsPage(props: PageProps<'/rooms'>) {
  const searchParams = await props.searchParams

  const filters: SearchFilters = {
    checkin: typeof searchParams.checkin === 'string' ? searchParams.checkin : undefined,
    checkout: typeof searchParams.checkout === 'string' ? searchParams.checkout : undefined,
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
            {/* Sidebar (filters + search summary) */}
            <div className="flex flex-col gap-6">
              <SearchSummaryCard
                checkin={filters.checkin}
                checkout={filters.checkout}
                guests={filters.guests}
              />
              <FilterSidebarServer />
            </div>

            {/* Results */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-3xl text-primary">ห้องพักที่ว่าง</h1>
                <span className="text-body-md text-on-surface-variant">
                  แสดง {total} ห้อง
                </span>
              </div>

              <FilterChips />

              <FloorGroupSection rooms={rooms} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
