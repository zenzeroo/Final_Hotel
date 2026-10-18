import Link from 'next/link'
import type { DashboardAlert } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { formatTHB } from '@/lib/pricing'
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

const MAX_ROOMS = 5

interface AlertsPanelProps {
  alerts: DashboardAlert[]
  locale: Locale
}

/**
 * Phase 54 — one aggregated alert per kind (count + rooms/amount), text
 * localized here from `manager.alerts.<kind>.*`.
 */
export function AlertsPanel({ alerts, locale }: AlertsPanelProps) {
  const t = getT(locale)
  const bcp = locale === 'en' ? 'en-GB' : 'th-TH'

  const roomsText = (rooms: string[] = []) =>
    rooms.length > MAX_ROOMS
      ? `${rooms.slice(0, MAX_ROOMS).join(', ')} ${t('manager.alerts.more', { count: rooms.length - MAX_ROOMS })}`
      : rooms.join(', ')

  if (alerts.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t('manager.alerts.title')}</h3>
        <p className="text-body-md text-on-surface-variant italic">{t('manager.alerts.empty')}</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-4">
      <h3 className="font-headline-sm text-headline-sm text-primary">{t('manager.alerts.title')}</h3>
      <ul className="flex flex-col gap-3">
        {alerts.map((a) => {
          const params = {
            count: a.count,
            rooms: roomsText(a.rooms),
            amount: a.amount !== undefined ? formatTHB(a.amount, bcp) : '',
          }
          return (
            <li key={a.id} className={`border-l-4 ${SEVERITY_BORDER[a.severity]} pl-4 py-2`}>
              <div className="flex items-start gap-2">
                <MaterialIcon
                  name={SEVERITY_ICON[a.severity]}
                  size={20}
                  className={`mt-0.5 ${SEVERITY_ICON_COLOR[a.severity]}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md font-semibold text-primary">
                    {t(`manager.alerts.${a.kind}.title`, params)}
                  </p>
                  <p className="text-caption text-on-surface-variant mt-1 break-words">
                    {t(`manager.alerts.${a.kind}.desc`, params)}
                  </p>
                  <Link
                    href={a.href}
                    className="inline-flex items-center gap-1 mt-2 text-caption text-primary underline underline-offset-4"
                  >
                    {t(`manager.alerts.${a.kind}.cta`)}
                    <MaterialIcon name="arrow_forward" size={14} />
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
