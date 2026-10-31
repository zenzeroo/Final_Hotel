import { SeverityBadge } from '@/components/housekeeping/SeverityBadge'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import { ConfirmMaintenanceButton } from '@/components/manager/ConfirmMaintenanceButton'
import { ResolveMaintenanceButton } from '@/components/manager/ResolveMaintenanceButton'
import { formatDateTime } from '@/lib/dates'
import type { MaintenanceReport } from '@/lib/data/types'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

export function MaintenanceReportTable({
  reports,
  locale,
}: {
  reports: MaintenanceReport[]
  locale: Locale
}) {
  const t = getT(locale)
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-x-auto">
      <table className="w-full text-left text-body-md">
        <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant whitespace-nowrap">
          <tr>
            <th className="py-3 px-4">{t('manager.maintenancePage.colRoom')}</th>
            <th className="py-3 px-4">{t('manager.maintenancePage.colIssue')}</th>
            <th className="py-3 px-4">{t('manager.maintenancePage.colSeverity')}</th>
            <th className="py-3 px-4">{t('manager.maintenancePage.colStatus')}</th>
            <th className="py-3 px-4">{t('manager.maintenancePage.colReporter')}</th>
            <th className="py-3 px-4">{t('manager.maintenancePage.colReportedAt')}</th>
            <th className="py-3 px-4 text-right">{t('manager.maintenancePage.colAction')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} className="border-b border-outline-variant last:border-b-0 align-middle">
              <td className="py-3 px-4 font-mono font-bold text-on-surface whitespace-nowrap">
                {r.room_unit?.unit_label ?? '—'}
              </td>
              <td className="py-3 px-4 min-w-64">
                <p className="font-semibold text-on-surface">{r.title}</p>
                <p className="text-caption text-on-surface-variant">
                  {t(`staff.issueType.${r.issue_type}`)}
                  {r.description && <> · {r.description}</>}
                </p>
              </td>
              <td className="py-3 px-4 whitespace-nowrap">
                <SeverityBadge severity={r.severity} />
              </td>
              <td className="py-3 px-4 whitespace-nowrap">
                <StatusBadge status={r.status} />
              </td>
              <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                {r.reporter?.full_name ?? t('staff.unknownPerson')}
              </td>
              <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                {formatDateTime(r.created_at, LOCALE_BCP47[locale])}
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                {r.status === 'open' && <ConfirmMaintenanceButton reportId={r.id} />}
                {r.status === 'in_progress' && <ResolveMaintenanceButton reportId={r.id} />}
                {r.status === 'resolved' && <span className="text-on-surface-variant">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
