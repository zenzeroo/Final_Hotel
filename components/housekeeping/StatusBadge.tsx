'use client'

import type { HousekeepingTaskStatus, MaintenanceStatus, RoomUnitStatus } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'

type AnyStatus = HousekeepingTaskStatus | MaintenanceStatus | RoomUnitStatus

// Labels: `staff.status.<status>` (Phase 27.E).
const STYLES: Record<AnyStatus, { bg: string; text: string }> = {
  unassigned: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  assigned: { bg: 'bg-secondary/10', text: 'text-secondary' },
  in_progress: { bg: 'bg-secondary/30', text: 'text-on-secondary-container' },
  completed: { bg: 'bg-primary-container', text: 'text-on-primary-container' },
  cancelled: { bg: 'bg-surface-container', text: 'text-on-surface-variant' },
  open: { bg: 'bg-error-container', text: 'text-on-error-container' },
  resolved: { bg: 'bg-primary-container', text: 'text-on-primary-container' },
  available: { bg: 'bg-primary-container', text: 'text-on-primary-container' },
  occupied: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container' },
  cleaning: { bg: 'bg-secondary/30', text: 'text-on-secondary-container' },
  maintenance: { bg: 'bg-error-container', text: 'text-on-error-container' },
  out_of_order: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  // Phase 30.1 — DB CHECK widened to include these 4 new values.
  waiting_cleaning: { bg: 'bg-error-container', text: 'text-on-error-container' },
  inspection: { bg: 'bg-secondary/30', text: 'text-on-secondary-container' },
  ready: { bg: 'bg-primary-container', text: 'text-on-primary-container' },
  checkout: { bg: 'bg-error-container', text: 'text-on-error-container' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const t = useT()
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {t(`staff.status.${status}`)}
    </span>
  )
}
