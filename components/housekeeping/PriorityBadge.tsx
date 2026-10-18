'use client'

import type { HousekeepingTaskPriority } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'

// Labels: `staff.priority.<priority>` (Phase 27.E).
const STYLES: Record<HousekeepingTaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant' },
  normal: { bg: 'bg-secondary/10', text: 'text-secondary' },
  high: { bg: 'bg-secondary/30', text: 'text-on-secondary-container' },
  urgent: { bg: 'bg-error-container', text: 'text-on-error-container' },
}

export function PriorityBadge({ priority }: { priority: HousekeepingTaskPriority }) {
  const t = useT()
  const s = STYLES[priority]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {t(`staff.priority.${priority}`)}
    </span>
  )
}
