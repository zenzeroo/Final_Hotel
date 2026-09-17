import { getMaintenanceReports } from '@/lib/data/housekeeper'
import { MaintenanceReportCard } from '@/components/housekeeping/MaintenanceReportCard'
import type { MaintenanceStatus } from '@/lib/data/types'

export const dynamic = 'force-dynamic'

type FilterStatus = 'all' | MaintenanceStatus

const STATUS_FILTERS: FilterStatus[] = ['all', 'open', 'in_progress', 'resolved']

const STATUS_FILTER_LABELS: Record<FilterStatus, string> = {
  all: 'ทั้งหมด',
  open: 'เปิดอยู่',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
}

export default async function ReceptionMaintenance(props: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await props.searchParams
  const filter = (STATUS_FILTERS as string[]).includes((params.status as string) ?? 'all')
    ? ((params.status as FilterStatus) ?? 'all')
    : 'all'

  // Read-only view — reception sees the same report queue as manager.
  // Status changes happen via /manager/maintenance.
  const reports = await getMaintenanceReports(filter === 'all' ? undefined : { status: [filter] })

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-primary mb-2">
          รายงานการซ่อมบำรุง
        </h1>
        <p className="text-body-md text-on-surface-variant">
          ดูสถานะห้องที่อยู่ระหว่างซ่อมบำรุง — การยืนยัน/ปิดงานทำโดยผู้จัดการเท่านั้น
        </p>
      </header>

      <nav className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/reception/maintenance' : `/reception/maintenance?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {STATUS_FILTER_LABELS[f]}
          </a>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">
          ไม่มีรายงานที่ตรงกับตัวกรองนี้
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <MaintenanceReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  )
}
