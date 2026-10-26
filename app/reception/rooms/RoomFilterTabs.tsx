'use client'

import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { FILTER_BUCKET, type RoomBucket } from '@/components/manager/roomStatusBuckets'

const TABS = [
  { value: 'all', label: 'reception.roomsPage.filterAll', icon: null },
  { value: 'available', label: 'reception.roomsPage.statusAvailable', icon: 'check_circle' },
  { value: 'occupied', label: 'reception.roomsPage.statusOccupied', icon: 'group' },
  { value: 'cleaning', label: 'reception.roomsPage.statusCleaning', icon: 'cleaning_services' },
  { value: 'maintenance', label: 'reception.roomsPage.statusMaintenance', icon: 'build' },
] as const

export function RoomFilterTabs({
  current,
  counts,
}: {
  current: string
  counts: { all: number } & Record<RoomBucket, number>
}) {
  const t = useT()
  // Same underlined tab style as /reception/check-in-out (CheckInOutViewTabs).
  const baseTab =
    'inline-flex items-center gap-2 px-4 py-2 -mb-px text-label-md font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap'
  const activeClass = 'border-primary text-primary bg-surface-container'
  const inactiveClass = 'border-transparent text-on-surface-variant hover:bg-surface-container hover:text-primary'
  return (
    <div
      role="tablist"
      aria-label={t('reception.roomsPage.title')}
      className="flex items-center gap-1 border-b border-outline-variant overflow-x-auto"
      suppressHydrationWarning
    >
      {TABS.map((tab) => {
        const isActive = current === tab.value
        const count = tab.value === 'all' ? counts.all : counts[FILTER_BUCKET[tab.value]]
        return (
          <a
            key={tab.value}
            href={`/reception/rooms?status=${tab.value}`}
            role="tab"
            aria-selected={isActive}
            className={`${baseTab} ${isActive ? activeClass : inactiveClass}`}
          >
            {tab.icon && <MaterialIcon name={tab.icon} size={16} />}
            {t(tab.label)} ({count})
          </a>
        )
      })}
    </div>
  )
}
