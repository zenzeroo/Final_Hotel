import Link from 'next/link'
import type { RoomType } from '@/lib/data/types'
import { getT } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/config'
import { roomTypeLabel } from '@/lib/format/roomType'
import { RoomCard } from './RoomCard'

interface FloorGroupSectionProps {
  rooms: RoomType[]
  locale: Locale
  /** Forwarded onto `<RoomCard>` so each card's href carries checkin/checkout/guests. */
  searchParams?: Record<string, string | string[] | undefined>
  /** Shown when nothing is free: the same stay one day later, and the dates without filters. */
  emptyActions?: { laterHref: string; clearHref: string }
}

export function FloorGroupSection({ rooms, locale, searchParams, emptyActions }: FloorGroupSectionProps) {
  const t = getT(locale)
  // Group by floor
  const grouped = rooms.reduce<Record<number, RoomType[]>>((acc, room) => {
    const floor = room.floor
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})

  const floors = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)

  if (rooms.length === 0) {
    return (
      <div className="py-16 md:py-24 bg-surface-container-low rounded-2xl px-6 md:px-12">
        <h2 className="font-display text-[32px] leading-[1.1] text-primary">{t('customer.floors.emptyTitle')}</h2>
        <p className="mt-3 max-w-[48ch] text-body-md text-on-surface">{t('customer.floors.emptyBody')}</p>
        {emptyActions && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={emptyActions.laterHref}
              className="inline-flex items-center h-12 px-6 bg-primary text-on-primary font-semibold text-body-md hover:bg-primary-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              {t('customer.floors.tryLater')}
            </Link>
            <Link
              href={emptyActions.clearHref}
              className="inline-flex items-center h-12 px-6 bg-surface-container-lowest text-primary font-semibold text-body-md hover:bg-primary-fixed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              {t('customer.floors.clearFilters')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      {floors.map((floor) => (
        <section key={floor}>
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h2 className="font-display text-2xl text-primary">
              {t('customer.floors.floor', { floor })}
              {floor === 4 && (
                <span className="ml-3 font-body text-body-md text-on-surface-variant">
                  {t('customer.floors.executive')}
                </span>
              )}
              {floor === 3 && (
                <span className="ml-3 font-body text-body-md text-on-surface-variant">
                  {t('customer.floors.seaView')}
                </span>
              )}
            </h2>
            <span className="text-[14px] text-on-surface-variant shrink-0">
              {t('customer.floors.roomCount', { count: grouped[floor].length })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {grouped[floor].map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                locale={locale}
                typeLabel={roomTypeLabel(room.type, locale)}
                maxGuestsLabel={t('roomCard.maxGuests', { count: room.max_guests })}
                searchParams={searchParams}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
