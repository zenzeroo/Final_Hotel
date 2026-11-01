'use client'

import { Tabs } from '@/components/ui/Tabs'
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
  return (
    <Tabs
      active={current}
      tabs={TABS.map((tab) => ({
        key: tab.value,
        label: t(tab.label),
        icon: tab.icon ?? undefined,
        href: tab.value === 'all' ? '/reception/rooms' : `/reception/rooms?status=${tab.value}`,
        badge: tab.value === 'all' ? counts.all : counts[FILTER_BUCKET[tab.value]],
      }))}
    />
  )
}
