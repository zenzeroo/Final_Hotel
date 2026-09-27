import Link from 'next/link'
import { searchRooms } from '@/lib/data/rooms'
import { RoomImage } from '@/components/room/RoomImage'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { SearchBar } from '@/components/search/SearchBar'
import { formatTHB } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function WalkInBookingPage(props: PageProps<'/reception/bookings/new'>) {
  const searchParams = await props.searchParams

  // Phase 45 — read dates/guests from URL so the SearchBar at the top can
  // drive availability filtering in-place (mirror of the /rooms list page
  // pattern). Receptionist sets dates first, then picks a room card.
  const checkin = typeof searchParams.checkin === 'string' ? searchParams.checkin : undefined
  const checkout = typeof searchParams.checkout === 'string' ? searchParams.checkout : undefined
  const guestsParam = typeof searchParams.guests === 'string' ? parseInt(searchParams.guests, 10) : NaN
  const guests = Number.isFinite(guestsParam) && guestsParam > 0 ? guestsParam : 1

  const result = checkin && checkout
    ? await searchRooms({ checkin, checkout, guests })
    : await searchRooms({ guests })
  const rooms = result.rooms

  // Build the per-card href so WalkInForm pre-fills the same dates/guests.
  const cardHref = (roomId: string) => {
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    if (checkin) params.set('checkin', checkin)
    if (checkout) params.set('checkout', checkout)
    if (guests) params.set('guests', String(guests))
    return `/reception/bookings/new/create?${params.toString()}`
  }

  const hasDateFilter = Boolean(checkin && checkout)

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">การจองแบบ Walk-in</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          เลือกห้องพักเพื่อสร้างการจองสำหรับลูกค้าที่มาถึงโดยไม่ได้จองล่วงหน้า
        </p>
      </div>

      {/* Phase 45 — SearchBar at top, similar to /rooms list. Compact
          variant reused via navigateTo prop so URL updates stay on this
          picker page (filtering in-place) instead of jumping to /rooms.
          showSeeAll=false because the walk-in picker doesn't honour the
          viewAll=1 param. */}
      <div className="mb-6">
        <SearchBar
          variant="compact"
          navigateTo="/reception/bookings/new"
          showSeeAll={false}
          defaultCheckin={checkin}
          defaultCheckout={checkout}
          defaultGuests={guests}
        />
      </div>

      {rooms.length === 0 && hasDateFilter ? (
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-10 text-center">
          <MaterialIcon name="event_busy" size={36} className="text-outline-variant mb-3" />
          <p className="text-body-lg text-on-surface-variant">
            ไม่มีห้องว่างในช่วงวันที่เลือก ({checkin} – {checkout})
          </p>
          <p className="text-body-md text-on-surface-variant mt-1">
            ลองเปลี่ยนวันที่หรือจำนวนผู้เข้าพักด้านบน
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={cardHref(room.id)}
              className="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden shadow-(--shadow-ambient) border border-outline-variant hover:shadow-(--shadow-ambient-md) transition-all"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <RoomImage
                  imageKey={room.hero_image_key}
                  alt={room.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-secondary rounded-full text-caption font-semibold uppercase tracking-wider">
                  {room.type}
                </span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-display text-lg text-primary">{room.name_th}</h3>
                <p className="text-caption text-on-surface-variant line-clamp-2 flex-1 mb-0">
                  {room.short_desc}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-caption text-on-surface-variant">เริ่มต้น</span>
                    <span className="text-xl font-display font-bold text-primary ml-1 whitespace-nowrap">
                      {formatTHB(room.base_price)}
                    </span>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-secondary">
                    <MaterialIcon name="arrow_forward" size={18} />
                  </span>
                </div>
                <p className="text-caption text-on-surface-variant mt-2">
                  สูงสุด {room.max_guests} ท่าน
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
