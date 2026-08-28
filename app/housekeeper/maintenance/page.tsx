import { getMaintenanceReports, getAllRoomUnits } from '@/lib/data/housekeeper'
import { MaintenanceReportCard } from '@/components/housekeeping/MaintenanceReportCard'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import type { MaintenanceStatus } from '@/lib/data/types'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS: ('all' | MaintenanceStatus)[] = ['all', 'open', 'in_progress', 'resolved']

const STATUS_FILTER_LABELS: Record<'all' | MaintenanceStatus, string> = {
  all: 'ทั้งหมด',
  open: 'เปิดอยู่',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
}

export default async function MaintenanceReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const filter = ((params.status as string) || 'all') as 'all' | MaintenanceStatus
  const reports = await getMaintenanceReports(filter === 'all' ? undefined : { status: [filter] })
  const roomUnits = await getAllRoomUnits()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">รายงานการซ่อมบำรุงและความเสียหาย</h1>
          <p className="text-body-lg text-on-surface-variant">ติดตามปัญหาที่แจ้งเข้ามาทั้งโรงแรม</p>
        </div>
        <MaintenanceReportModal roomUnits={roomUnits} />
      </header>

      <nav className="flex gap-2 mb-8 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/housekeeper/maintenance' : `/housekeeper/maintenance?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {STATUS_FILTER_LABELS[f]}
          </a>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">ไม่มีรายงานที่ตรงกับตัวกรองนี้</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => <MaintenanceReportCard key={r.id} report={r} />)}
        </div>
      )}

      <p className="mt-8 text-caption text-on-surface-variant italic">
        หมายเหตุ: การแก้ไขรายงานต้องใช้สิทธิ์ผู้จัดการ (เร็วๆ นี้)
      </p>
    </div>
  )
}