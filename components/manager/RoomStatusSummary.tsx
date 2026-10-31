import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { countRoomBuckets } from './roomStatusBuckets'

/**
 * Live room-status bars (available / occupied / cleaning / closed) shared by
 * the reception and manager dashboards. Same buckets as /reception/rooms:
 * ready counts as available, the whole cleaning flow as cleaning, a
 * checked-in booking as occupied. The caller supplies the card + heading.
 */
export function RoomStatusSummary({
  rooms,
  locale,
  href,
}: {
  rooms: readonly { status: string; staying?: unknown }[]
  locale: Locale
  href: string
}) {
  const t = getT(locale)
  const buckets = countRoomBuckets(rooms)
  const total = rooms.length
  return (
    <>
      <div className="flex flex-col gap-3">
        <RoomStat label={t('reception.available')} value={buckets.available} total={total} color="primary" />
        <RoomStat label={t('reception.occupied')} value={buckets.occupied} total={total} color="secondary" />
        <RoomStat label={t('reception.cleaning')} value={buckets.cleaning} total={total} color="tertiary" />
        <RoomStat label={t('reception.maintenance')} value={buckets.closed} total={total} color="error" />
      </div>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-2 text-label-md text-primary px-2 py-1 rounded font-semibold uppercase tracking-wider hover:bg-primary-fixed hover:text-primary"
      >
        {t('reception.roomsPage.byFloor')}
        <MaterialIcon name="arrow_forward" size={16} />
      </Link>
    </>
  )
}

const BAR_COLOR = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  error: 'bg-error',
} as const

function RoomStat({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: keyof typeof BAR_COLOR
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-body-md text-on-surface">{label}</span>
        <span className="text-body-md font-semibold text-on-surface">
          {value}/{total}
        </span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div className={`h-full ${BAR_COLOR[color]} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
