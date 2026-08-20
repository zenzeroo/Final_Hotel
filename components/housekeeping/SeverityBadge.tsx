import type { MaintenanceSeverity } from '@/lib/data/types'

const STYLES: Record<MaintenanceSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', label: 'Low' },
  medium: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'Medium' },
  high: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'High' },
  critical: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Critical' },
}

export function SeverityBadge({ severity }: { severity: MaintenanceSeverity }) {
  const s = STYLES[severity]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}