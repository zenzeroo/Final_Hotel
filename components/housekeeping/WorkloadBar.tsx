/**
 * Phase 30 — presentational workload progress bar.
 *
 * Props:
 *   - loadMinutes: current Σ estimated_minutes for this housekeeper
 *   - capacityMinutes: 480 when on shift (8h), 0 when off duty
 *   - label: optional override (default: "{load} / {capacity} นาที ({pct}%)")
 *
 * Color logic (uses design tokens from app/globals.css @theme):
 *   - <60%   → secondary (gold)
 *   - 60-90%  → tertiary (burgundy)
 *   - >90%    → error (red)
 *   - off duty → on-surface-variant (grey)
 */
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface WorkloadBarProps {
  loadMinutes: number
  capacityMinutes: number
  label?: string
}

function colorClass(percent: number, isAvailable: boolean): string {
  if (!isAvailable) return 'bg-on-surface-variant/20 text-on-surface-variant'
  if (percent > 90) return 'bg-error/15 text-error'
  if (percent >= 60) return 'bg-tertiary/15 text-tertiary'
  return 'bg-secondary/15 text-secondary'
}

export function WorkloadBar({ loadMinutes, capacityMinutes, label }: WorkloadBarProps) {
  const isAvailable = capacityMinutes > 0
  const percent = capacityMinutes > 0
    ? Math.min(100, Math.round((loadMinutes / capacityMinutes) * 100))
    : 0
  const displayLabel = label ?? `${loadMinutes} / ${capacityMinutes} นาที (${percent}%)`
  const barColor = isAvailable
    ? percent > 90 ? 'bg-error' : percent >= 60 ? 'bg-tertiary' : 'bg-secondary'
    : 'bg-on-surface-variant/40'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-caption font-semibold ${colorClass(percent, isAvailable).split(' ').pop()}`}>
          {displayLabel}
        </span>
        {!isAvailable && (
          <MaterialIcon name="event_busy" size={14} className="text-on-surface-variant" />
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-200`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}