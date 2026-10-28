import Link from 'next/link'
import { searchRooms } from '@/lib/data/rooms'
import { RoomImage } from '@/components/room/RoomImage'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { SearchBar } from '@/components/search/SearchBar'
import { formatTHB } from '@/lib/pricing'
import { getMinCheckInLocalIso, addDaysLocalIso } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function WalkInBookingPage(props: PageProps<'/reception/bookings/new'>) {
  const t = getT(await getLocale())
  const searchParams = await props.searchParams

  // Phase 45 — read dates/guests from URL so the SearchBar at the top can
  // drive availability filtering in-place (mirror of the /rooms list page
  // pattern). Receptionist sets dates first, then picks a room card.
  //
  // Phase 45.1 — always-default checkin/checkout/guests so card hrefs
  // always carry the values the receptionist is currently seeing on the
  // SearchBar. Without defaults, visiting `/reception/bookings/new`
  // produced `?roomId=X&guests=1` hrefs with no dates → WalkInForm fell
  // back to its own (buggy today/tomorrow) defaults. Now card hrefs are
  // stable and always include all 3 params.
  //
  // Availability always runs on those dates (today → tomorrow by default),
  // like /rooms — a room type fully booked for the dates on the SearchBar
  // is never offered.
  const minCheckin = getMinCheckInLocalIso()
  const defaultCheckout = addDaysLocalIso(minCheckin, 1)

  const checkin =
    typeof searchParams.checkin === 'string' && searchParams.checkin >= minCheckin
      ? searchParams.checkin
      : minCheckin
  const checkout =
    typeof searchParams.checkout === 'string' && searchParams.checkout > checkin
      ? searchParams.checkout
      : defaultCheckout
  const guests = (() => {
    const n =
      typeof searchParams.guests === 'string' ? parseInt(searchParams.guests, 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : 1
  })()

  const { rooms } = await searchRooms({ checkin, checkout, guests })

  // Build the per-card href so WalkInForm pre-fills the same dates/guests
  // the receptionist is currently seeing on the SearchBar. All three
  // params are always present — Phase 45.1 fix.
  const cardHref = (roomId: string) => {
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    params.set('checkin', checkin)
    params.set('checkout', checkout)
    params.set('guests', String(guests))
    return `/reception/bookings/new/create?${params.toString()}`
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.walkIn.pickerHeading')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.walkIn.pickerSubtitle')}
        </p>
      </div>

      {/* Phase 45 — SearchBar at top, similar to /rooms list. Compact
          variant reused via navigateTo prop so URL updates stay on this
          picker page (filtering in-place) instead of jumping to /rooms.
          showReset=false because the walk-in picker has no sidebar
          filters to reset. */}
      <div className="mb-6">
        <SearchBar
          variant="compact"
          navigateTo="/reception/bookings/new"
          showReset={false}
          defaultCheckin={checkin}
          defaultCheckout={checkout}
          defaultGuests={guests}
        />
      </div>

      {rooms.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-10 text-center">
          <MaterialIcon name="event_busy" size={36} className="text-outline-variant mb-3" />
          <p className="text-body-lg text-on-surface-variant">
            {t('reception.walkIn.noRooms', { from: checkin, to: checkout })}
          </p>
          <p className="text-body-md text-on-surface-variant mt-1">
            {t('reception.walkIn.noRoomsHint')}
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
                    <span className="text-caption text-on-surface-variant">{t('reception.walkIn.from')}</span>
                    <span className="text-xl font-display font-bold text-primary ml-1 whitespace-nowrap">
                      {formatTHB(room.base_price)}
                    </span>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-secondary">
                    <MaterialIcon name="arrow_forward" size={18} />
                  </span>
                </div>
                <p className="text-caption text-on-surface-variant mt-2">
                  {t('reception.walkIn.maxGuests', { count: room.max_guests })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
