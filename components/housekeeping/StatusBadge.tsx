import type { HousekeepingTaskStatus, MaintenanceStatus, RoomUnitStatus } from '@/lib/data/types'

type AnyStatus = HousekeepingTaskStatus | MaintenanceStatus | RoomUnitStatus

const STYLES: Record<AnyStatus, { bg: string; text: string; label: string }> = {
  unassigned: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Unassigned' },
  assigned: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'Assigned' },
  in_progress: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'In Progress' },
  completed: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'Completed' },
  cancelled: { bg: 'bg-surface-container', text: 'text-on-surface-variant', label: 'Cancelled' },
  open: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Open' },
  resolved: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'Resolved' },
  available: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'Available' },
  occupied: { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container', label: 'Occupied' },
  cleaning: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'Cleaning' },
  maintenance: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Maintenance' },
  out_of_order: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Out of Order' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}