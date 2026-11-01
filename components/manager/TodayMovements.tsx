import Link from 'next/link'
import type { MovementRow } from '@/lib/data/types'
import type { NotReadyReason, RoomPlan } from '@/lib/room-status'
import { roomPlanNote } from '@/lib/room-status-text'
import { localizedName } from '@/lib/format/roomType'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

const TONE = {
  ready: { dot: 'bg-primary', text: 'text-primary' },
  problem: { dot: 'bg-error', text: 'text-error' },
  stay: { dot: 'bg-secondary', text: 'text-on-surface' },
}

/** Today's arrivals and departures side by side, each row opening the booking. */
export function TodayMovements({
  data,
  locale,
}: {
  data: {
    arrivals: MovementRow[]
    departures: MovementRow[]
    plans: Map<string, RoomPlan>
    reasons: Record<string, NotReadyReason>
  }
  locale: Locale
}) {
  const t = getT(locale)
  const lists = [
    { id: 'arrivals', title: t('manager.movements.arrivals'), rows: data.arrivals },
    { id: 'departures', title: t('manager.movements.departures'), rows: data.departures },
  ]
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {lists.map((list) => (
        <section key={list.id} aria-labelledby={`movements-${list.id}`} className="bg-surface-container-lowest rounded-2xl">
          <h2
            id={`movements-${list.id}`}
            className="px-5 md:px-6 pt-5 md:pt-6 pb-4 font-display text-xl text-primary border-b border-surface-container"
          >
            {list.title} <span className="text-on-surface-variant tabular-nums">· {list.rows.length}</span>
          </h2>
          {list.rows.length === 0 ? (
            <p className="px-5 md:px-6 py-6 text-body-md text-on-surface-variant">{t('manager.movements.none')}</p>
          ) : (
            <ul>
              {list.rows.map((b) => {
                const note = roomPlanNote(
                  data.plans.get(b.id) ?? { kind: 'none' },
                  data.reasons,
                  t,
                  b.check_out,
                  LOCALE_BCP47[locale],
                )
                const tone = TONE[note.tone]
                return (
                  <li key={b.id} className="border-t border-surface-container first:border-t-0">
                    <Link
                      href={`/manager/bookings/${b.id}`}
                      className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 md:px-6 py-3.5 hover:bg-surface-container-low transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-secondary"
                    >
                      <span className="w-14 shrink-0 text-body-lg font-semibold text-primary">{note.room}</span>
                      <span className="flex-1 min-w-40">
                        <span className="block text-body-md font-medium text-on-surface [overflow-wrap:anywhere]">
                          {b.booker_full_name}
                        </span>
                        <span className="block text-[14px] text-on-surface-variant">
                          {b.booking_code} · {localizedName(b.room_type, locale)}
                        </span>
                      </span>
                      <span className={`flex items-start gap-2 text-[14px] min-w-40 max-w-full ${tone.text}`}>
                        <span aria-hidden className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
                        {note.note}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
