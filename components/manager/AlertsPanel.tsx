import Link from 'next/link'
import type { DashboardAlert } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

const SEVERITY_BORDER: Record<DashboardAlert['severity'], string> = {
  critical: 'border-error',
  warning: 'border-secondary',
  info: 'border-outline',
}

const SEVERITY_ICON: Record<DashboardAlert['severity'], string> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
}

const SEVERITY_ICON_COLOR: Record<DashboardAlert['severity'], string> = {
  critical: 'text-error',
  warning: 'text-secondary',
  info: 'text-on-surface-variant',
}

interface AlertsPanelProps {
  alerts: DashboardAlert[]
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-2">Alerts</h3>
        <p className="text-body-md text-on-surface-variant italic">No active alerts.</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-4">
      <h3 className="font-headline-sm text-headline-sm text-primary">Alerts</h3>
      <ul className="flex flex-col gap-3">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={`border-l-4 ${SEVERITY_BORDER[a.severity]} pl-4 py-2`}
          >
            <div className="flex items-start gap-2">
              <MaterialIcon
                name={SEVERITY_ICON[a.severity]}
                size={20}
                className={`mt-0.5 ${SEVERITY_ICON_COLOR[a.severity]}`}
              />
              <div className="flex-1">
                <p className="text-body-md font-semibold text-primary">{a.title}</p>
                <p className="text-caption text-on-surface-variant mt-1">{a.description}</p>
                {a.cta ? (
                  a.cta.href ? (
                    <Link
                      href={a.cta.href}
                      className="inline-flex items-center gap-1 mt-2 text-caption text-primary underline underline-offset-4"
                    >
                      {a.cta.label}
                      <MaterialIcon name="arrow_forward" size={14} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 mt-2 text-caption text-primary underline underline-offset-4"
                    >
                      {a.cta.label}
                      <MaterialIcon name="arrow_forward" size={14} />
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
