import type { HousekeepingTaskPriority } from '@/lib/data/types'

const STYLES: Record<HousekeepingTaskPriority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', label: 'ต่ำ' },
  normal: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'ปกติ' },
  high: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'สูง' },
  urgent: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'เร่งด่วน' },
}

export function PriorityBadge({ priority }: { priority: HousekeepingTaskPriority }) {
  const s = STYLES[priority]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}