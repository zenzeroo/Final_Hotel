import { getHousekeepingOverview } from '@/lib/data/manager'
import { KpiCard } from '@/components/manager/KpiCard'
import { FloorStatusGroup } from '@/components/manager/FloorStatusGroup'
import { FloorAssignmentCard } from '@/components/manager/FloorAssignmentCard'
import { UnassignedTaskList } from '@/components/manager/UnassignedTaskList'
import { DamageReportTable } from '@/components/manager/DamageReportTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function ManagerHousekeepingPage() {
  const data = await getHousekeepingOverview()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            Housekeeping Overview
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            Zenzero Hotel Operations · {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-primary text-secondary px-4 py-2 rounded-md text-body-md font-semibold"
        >
          <MaterialIcon name="print" size={18} />
          Print Daily Report
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <KpiCard label="Total Rooms" icon="hotel">
          <p className="font-display-lg text-display-lg-mobile text-primary">{data.totalRooms}</p>
        </KpiCard>
        <KpiCard label="Dirty" icon="cleaning_services">
          <p className="font-display-lg text-display-lg-mobile text-error">{data.dirtyCount}</p>
        </KpiCard>
        <KpiCard label="Cleaning" icon="autorenew">
          <p className="font-display-lg text-display-lg-mobile text-secondary">
            {data.cleaningCount}
          </p>
        </KpiCard>
        <KpiCard label="Inspected / Ready" icon="verified" tone="gold">
          <p className="font-display-lg text-display-lg-mobile text-on-secondary-container">
            {data.inspectedCount}
          </p>
        </KpiCard>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-6">
            Real-Time Room Status
          </h3>
          <div className="flex flex-col gap-8">
            {data.floors.map((f) => (
              <FloorStatusGroup key={f.floor} group={f} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <FloorAssignmentCard assignments={data.floorAssignments} />
          <UnassignedTaskList tasks={data.unassignedTasks} />
        </div>
      </section>

      <section className="mb-12">
        <DamageReportTable reports={data.damageReports} />
      </section>
    </div>
  )
}
