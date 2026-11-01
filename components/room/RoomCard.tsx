import Link from 'next/link'
import type { RoomType } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { RoomImage } from './RoomImage'
import { RatingStars } from './RatingStars'
import { MaterialIcon } from '../ui/MaterialIcon'
import { getT } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/config'
import { localizedName } from '@/lib/format/roomType'

interface RoomCardProps {
  room: RoomType
  locale: Locale
  /** Pre-localised room-type label (e.g. 'ดีลักซ์' / 'Deluxe'). Passed from parent to keep this a Server Component. */
  typeLabel: string
  /** Pre-localised max-occupancy label (e.g. 'สูงสุด 4 ท่าน'). Passed from parent. */
  maxGuestsLabel: string
  /**
   * Current page's searchParams (Next.js 16 shape). Threaded onto the
   * Link so clicking a card preserves checkin+checkout+guests and the
   * destination `/rooms/[slug]` BookingWidget can pre-fill from them.
   */
  searchParams?: Record<string, string | string[] | undefined>
}

export function RoomCard({ room, locale, typeLabel, maxGuestsLabel, searchParams }: RoomCardProps) {
  const t = getT(locale)
  const href = buildRoomHref(room.slug, searchParams)
  const desc = (locale === 'th' && room.short_desc_th) || room.short_desc

  return (
    <Link
      href={href}
      className="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <RoomImage
          imageKey={room.hero_image_key}
          alt={localizedName(room, locale)}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <div className="p-6 flex flex-col gap-3 flex-1">
        <h3 className="font-display text-xl text-primary font-semibold">{localizedName(room, locale)}</h3>
        <p className="text-[14px] text-on-surface-variant">
          {typeLabel} · {maxGuestsLabel}
        </p>
        {desc && <p className="text-body-md text-on-surface-variant line-clamp-2 flex-1">{desc}</p>}
        {room.rating_count > 0 && <RatingStars value={room.rating_avg} count={room.rating_count} size={16} />}

        <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline-variant gap-3">
          <div className="min-w-0">
            <span className="text-[14px] text-on-surface-variant block">{t('customer.roomCard.from')}</span>
            <span className="text-2xl font-display font-bold text-primary whitespace-nowrap">{formatTHB(room.base_price)}</span>
            <span className="text-body-md text-on-surface-variant whitespace-nowrap"> {t('customer.roomCard.perNight')}</span>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            <MaterialIcon name="arrow_forward" size={20} />
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Build the room detail href, appending the current /rooms page's
 * searchParams (lowercase checkin/checkout/guests) so BookingWidget on
 * the destination page can pre-fill from them. Returns the bare path
 * when no relevant params are present.
 */
function buildRoomHref(
  slug: string,
  searchParams?: Record<string, string | string[] | undefined>,
): string {
  const base = `/rooms/${slug}`
  if (!searchParams) return base
  const checkin = pickParam(searchParams.checkin)
  const checkout = pickParam(searchParams.checkout)
  const guests = pickParam(searchParams.guests)
  if (!checkin && !checkout && !guests) return base
  const params = new URLSearchParams()
  if (checkin) params.set('checkin', checkin)
  if (checkout) params.set('checkout', checkout)
  if (guests) params.set('guests', guests)
  return `${base}?${params.toString()}`
}

function pickParam(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
}
