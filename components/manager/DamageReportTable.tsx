import type { DamageReport as DamageReportType } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ResolveDamageButton } from './ResolveDamageButton'
import { formatTHB } from '@/lib/pricing'
import { formatDate } from '@/lib/dates'

interface DamageReportTableProps {
  reports: DamageReportType[]
}

const SEVERITY_LABEL: Record<DamageReportType['severity'], string> = {
  normal: 'ปกติ',
  urgent: 'เร่งด่วน',
}

const SEVERITY_CLASS: Record<DamageReportType['severity'], string> = {
  normal: 'bg-surface-variant text-on-surface-variant',
  urgent: 'bg-error-container text-on-error-container',
}

export function DamageReportTable({ reports }: DamageReportTableProps) {
  if (reports.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-2">บันทึกรายงานความเสียหาย</h3>
        <p className="text-body-md text-on-surface-variant italic">ไม่มีรายงานความเสียหาย</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">บันทึกรายงานความเสียหาย</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-md">
          <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr>
              <th className="py-3 pr-4">ห้อง</th>
              <th className="py-3 pr-4">รายงานโดย</th>
              <th className="py-3 pr-4">คำอธิบาย</th>
              <th className="py-3 pr-4">รูปภาพ</th>
              <th className="py-3 pr-4">ความรุนแรง</th>
              <th className="py-3 pr-4">ค่าใช้จ่าย</th>
              <th className="py-3 pr-4">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant last:border-b-0">
                <td className="py-3 pr-4 font-semibold text-primary">{r.roomNumber}</td>
                <td className="py-3 pr-4 text-on-surface-variant">{r.reportedBy}</td>
                <td className="py-3 pr-4 text-on-surface max-w-xs">{r.description}</td>
                <td className="py-3 pr-4">
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photoUrl}
                      alt={`Damage in room ${r.roomNumber}`}
                      className="w-12 h-12 object-cover rounded-md"
                    />
                  ) : (
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-surface-variant text-on-surface-variant">
                      <MaterialIcon name="image" size={20} />
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-caption ${SEVERITY_CLASS[r.severity]}`}
                  >
                    {SEVERITY_LABEL[r.severity]}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {r.costEstimate != null ? (
                    formatTHB(r.costEstimate)
                  ) : (
                    <span className="text-on-surface-variant italic">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {r.resolved ? (
                    <span className="text-caption text-on-surface-variant">
                      แก้ไขแล้ว {r.resolvedAt ? formatDate(r.resolvedAt) : ''}
                    </span>
                  ) : (
                    <ResolveDamageButton reportId={r.id} defaultCost={r.costEstimate} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
