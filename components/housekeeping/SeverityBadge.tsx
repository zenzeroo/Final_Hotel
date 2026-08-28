import type { MaintenanceSeverity } from '@/lib/data/types'

const STYLES: Record<MaintenanceSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', label: 'ต่ำ' },
  medium: { bg: 'bg-secondary/10', text: 'text-secondary', label: 'ปานกลาง' },
  high: { bg: 'bg-secondary/30', text: 'text-on-secondary-container', label: 'สูง' },
  critical: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'วิกฤต' },
}

export function SeverityBadge({ severity }: { severity: MaintenanceSeverity }) {
  const s = STYLES[severity]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}