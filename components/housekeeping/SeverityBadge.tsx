'use client'

import type { MaintenanceSeverity } from '@/lib/data/types'
import { useT } from '@/lib/i18n/useT'

// Labels: `staff.severity.<severity>` (Phase 27.E).
const STYLES: Record<MaintenanceSeverity, { bg: string; text: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant' },
  medium: { bg: 'bg-secondary/10', text: 'text-secondary' },
  high: { bg: 'bg-secondary/30', text: 'text-on-secondary-container' },
  critical: { bg: 'bg-error-container', text: 'text-on-error-container' },
}

export function SeverityBadge({ severity }: { severity: MaintenanceSeverity }) {
  const t = useT()
  const s = STYLES[severity]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption uppercase tracking-wider ${s.bg} ${s.text}`}>
      {t(`staff.severity.${severity}`)}
    </span>
  )
}
