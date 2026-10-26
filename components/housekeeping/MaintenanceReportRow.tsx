import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateTime } from '@/lib/dates'
import type { MaintenanceReport } from '@/lib/data/types'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

/** Compact one-line version of MaintenanceReportCard (wraps on narrow screens). */
export function MaintenanceReportRow({
  report,
  locale = 'th',
}: {
  report: MaintenanceReport
  locale?: Locale
}) {
  const t = getT(locale)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-surface-container-low rounded-xl">
      <span className="font-mono text-body-md font-bold text-on-surface w-14 shrink-0">
        {report.room_unit?.unit_label ?? '—'}
      </span>
      <div className="flex-[2] min-w-48">
        <p className="text-body-md font-semibold text-on-surface truncate">{report.title}</p>
        <p className="text-caption text-on-surface-variant truncate">
          <span className="uppercase tracking-wider">{t(`staff.issueType.${report.issue_type}`)}</span>
          {report.description && <> · {report.description}</>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SeverityBadge severity={report.severity} />
        <StatusBadge status={report.status} />
      </div>
      <div className="ml-auto flex flex-col items-end gap-0.5 text-caption text-on-surface-variant shrink-0">
        <span className="flex items-center gap-1">
          <MaterialIcon name="person" size={14} />
          {report.reporter?.full_name ?? t('staff.unknownPerson')}
        </span>
        <span className="flex items-center gap-1">
          <MaterialIcon name="schedule" size={14} />
          {formatDateTime(report.created_at, LOCALE_BCP47[locale])}
        </span>
      </div>
    </div>
  )
}
