import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

export default async function HousekeeperDashboard() {
  const session = await getSession()
  const stats = await getMyDashboardStatsForUser(session!.id)
  const roomUnits = await getAllRoomUnits()
  const name = session!.fullName ?? 'Housekeeper'

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {greeting()}, {name}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">Here&apos;s your shift overview.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Rooms to Clean</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.roomsToClean}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Shift Progress</p>
          <ShiftProgress percent={stats.shiftProgress} />
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">My Tasks</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.myTasksCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Open Maintenance</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.maintenanceOpenCount}</p>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialIcon name="priority_high" size={24} className="text-error" />
            Priority Tasks
          </h2>
        </div>
        {stats.priorityTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No priority tasks right now.</p>
        ) : (
          <div className="space-y-3">
            {stats.priorityTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <MaterialIcon name="task_alt" size={24} />
          My Active Tasks
        </h2>
        {stats.activeTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No active tasks. Check the unassigned pool.</p>
        ) : (
          <div className="space-y-3">
            {stats.activeTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="flex justify-end">
        <MaintenanceReportModal roomUnits={roomUnits} />
      </section>
    </div>
  )
}