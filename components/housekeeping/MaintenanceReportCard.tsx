import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateTime } from '@/lib/dates'
import type { MaintenanceReport } from '@/lib/data/types'

const ISSUE_LABELS: Record<string, string> = {
  plumbing: 'ประปา',
  electrical: 'ไฟฟ้า',
  hvac: 'แอร์/เครื่องปรับอากาศ',
  furniture: 'เฟอร์นิเจอร์',
  appliance: 'เครื่องใช้ไฟฟ้า',
  other: 'อื่นๆ',
}

export function MaintenanceReportCard({ report }: { report: MaintenanceReport }) {
  const unit = report.room_unit
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-headline-sm text-headline-sm text-primary">{report.title}</h4>
        <SeverityBadge severity={report.severity} />
      </div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">
          {ISSUE_LABELS[report.issue_type] ?? report.issue_type}
        </span>
        <StatusBadge status={report.status} />
        {unit && (
          <span className="text-caption text-on-surface-variant">
            ห้อง {unit.unit_label}
          </span>
        )}
      </div>
      {report.description && (
        <p className="text-body-md text-on-surface-variant mb-3">{report.description}</p>
      )}
      <div className="flex items-center gap-3 text-caption text-on-surface-variant pt-3 border-t border-outline-variant/30">
        <span className="flex items-center gap-1">
          <MaterialIcon name="person" size={14} />
          {report.reporter?.full_name ?? 'ไม่ระบุ'}
        </span>
        <span className="flex items-center gap-1">
          <MaterialIcon name="schedule" size={14} />
          {formatDateTime(report.created_at)}
        </span>
      </div>
    </div>
  )
}