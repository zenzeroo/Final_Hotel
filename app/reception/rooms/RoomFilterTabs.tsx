'use client'

import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomFilterTabsProps {
  current: string
  counts: Record<string, number>
  statusMeta: Record<string, { label: string; color: string; bgColor: string; icon: string }>
}

const TABS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'available', label: 'ว่าง' },
  { value: 'occupied', label: 'มีแขก' },
  { value: 'cleaning', label: 'รอทำความสะอาด' },
  { value: 'maintenance', label: 'ปรับปรุง' },
]

export function RoomFilterTabs({ current, counts, statusMeta }: RoomFilterTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const isActive = current === tab.value
        const count = counts[tab.value] ?? 0
        const meta = statusMeta[tab.value]
        return (
          <a
            key={tab.value}
            href={`/reception/rooms?status=${tab.value}`}
            aria-current={isActive ? 'page' : undefined}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-label-md font-semibold transition-colors ${
              isActive
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {meta && <MaterialIcon name={meta.icon} size={16} />}
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-caption ${isActive ? 'bg-secondary/20 text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
              {count}
            </span>
          </a>
        )
      })}
    </div>
  )
}
