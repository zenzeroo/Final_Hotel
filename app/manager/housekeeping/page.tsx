import { getHousekeepingOverview } from '@/lib/data/manager'
import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { KpiCard } from '@/components/manager/KpiCard'
import { FloorStatusGroup } from '@/components/manager/FloorStatusGroup'
import { FloorAssignmentCard } from '@/components/manager/FloorAssignmentCard'
import { UnassignedTaskList } from '@/components/manager/UnassignedTaskList'
import { DamageReportTable } from '@/components/manager/DamageReportTable'
import { HousekeeperCards } from '@/components/manager/HousekeeperCards'
import { HousekeeperWorkloadTable } from '@/components/manager/HousekeeperWorkloadTable'
import { CreateTaskModal } from '@/components/housekeeping/CreateTaskModal'
import { RebalanceButton } from '@/components/housekeeping/RebalanceButton'
import { PrintDailyReportButton } from '@/components/housekeeping/PrintDailyReportButton'
import { formatDate } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function ManagerHousekeepingPage() {
  const locale = await getLocale()
  const t = getT(locale)
  const [data, roomUnits] = await Promise.all([
    getHousekeepingOverview(),
    getAllRoomUnits(),
  ])

  const availableHKs = data.housekeeperWorkloads.filter((h) => h.isAvailable).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            ภาพรวมแม่บ้าน
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            การดำเนินงาน Zenzero Hotel · {formatDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Phase 30.1 — auto-allocation button uses `totalUnassignedCount`
              (real DB count, not the capped .limit(20) array length). */}
          <RebalanceButton
            unassignedCount={data.totalUnassignedCount}
            availableHousekeepers={availableHKs}
          />
          <CreateTaskModal roomUnits={roomUnits} housekeepers={data.housekeepers} />
          {/* Phase 30.1 — B8a: previously a dead button without onClick; now
              wired to window.print() via the client component. */}
          <PrintDailyReportButton />
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <KpiCard label="ห้องทั้งหมด" icon="hotel">
          <p className="font-display-lg text-display-lg-mobile text-primary">{data.totalRooms}</p>
        </KpiCard>
        <KpiCard label="สกปรก" icon="cleaning_services">
          <p className="font-display-lg text-display-lg-mobile text-error">{data.dirtyCount}</p>
        </KpiCard>
        <KpiCard label="กำลังทำความสะอาด" icon="autorenew">
          <p className="font-display-lg text-display-lg-mobile text-secondary">
            {data.cleaningCount}
          </p>
        </KpiCard>
        <KpiCard label="ตรวจสอบแล้ว / พร้อมใช้" icon="verified" tone="gold">
          <p className="font-display-lg text-display-lg-mobile text-on-secondary-container">
            {data.inspectedCount}
          </p>
        </KpiCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-6">
            สถานะห้องแบบเรียลไทม์
          </h3>
          <div className="flex flex-col gap-8">
            {data.floors.map((f) => (
              <FloorStatusGroup key={f.floor} group={f} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <FloorAssignmentCard
            assignments={data.floorAssignments}
            housekeepers={data.housekeepers}
          />
          <UnassignedTaskList tasks={data.unassignedTasks} housekeepers={data.housekeepers} />
        </div>
      </section>

      {/* Phase 30 — workload summary table (one row per housekeeper). */}
      <HousekeeperWorkloadTable workloads={data.housekeeperWorkloads} t={t} />

      <HousekeeperCards cards={data.assignedByHousekeeper} housekeepers={data.housekeepers} />

      <section className="mb-12">
        <DamageReportTable reports={data.damageReports} />
      </section>
    </div>
  )
}