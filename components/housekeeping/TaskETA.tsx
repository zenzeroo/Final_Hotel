/**
 * Phase 30 — ETA pill for the housekeeper My-Tasks page.
 *
 * Shows:
 *   - `staff.minutesApprox` — total estimated minutes for this task (Phase 30)
 *   - `staff.checkInAt` — urgency warning when next check-in is <4h away
 *
 * Server component (no hooks needed — accepts ISO strings + locale-aware formatter).
 */
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getT } from '@/lib/i18n/t'

interface TaskETAProps {
  estimatedMinutes: number | null
  nextCheckIn: string | null
  /** Optional locale BCP47 for time formatting (e.g. 'th-TH', 'en-US'). */
  localeBcp?: string
}

const URGENT_WINDOW_MS = 4 * 60 * 60 * 1000 // 4 hours

function formatCheckInTime(iso: string, localeBcp?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(localeBcp ?? 'th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return d.toISOString().slice(11, 16) // fallback HH:MM
  }
}

export function TaskETA({ estimatedMinutes, nextCheckIn, localeBcp }: TaskETAProps) {
  const t = getT(localeBcp?.startsWith('en') ? 'en' : 'th')
  const items: Array<{ icon: string; label: string; tone: string }> = []

  if (typeof estimatedMinutes === 'number' && estimatedMinutes > 0) {
    items.push({
      icon: 'schedule',
      label: t('staff.minutesApprox', { count: estimatedMinutes }),
      tone: 'bg-secondary/10 text-secondary',
    })
  }

  if (nextCheckIn) {
    // Server component — single render at request time. Date.now() is fine.
    // eslint-disable-next-line react-hooks/purity
    const ms = new Date(nextCheckIn).getTime() - Date.now()
    if (!Number.isNaN(ms) && ms > 0 && ms < URGENT_WINDOW_MS) {
      items.push({
        icon: 'priority_high',
        label: t('staff.checkInAt', { time: formatCheckInTime(nextCheckIn, localeBcp) }),
        tone: 'bg-error/10 text-error',
      })
    }
  }

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((it, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-medium ${it.tone}`}
        >
          <MaterialIcon name={it.icon} size={12} />
          {it.label}
        </span>
      ))}
    </div>
  )
}