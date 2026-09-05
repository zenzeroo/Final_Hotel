import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

function greeting(t: ReturnType<typeof getT>): string {
  const h = new Date().getHours()
  if (h < 12) return t('manager.greetingMorning')
  if (h < 18) return t('manager.greetingAfternoon')
  return t('manager.greetingEvening')
}

export default async function HousekeeperDashboard() {
  const t = getT(await getLocale())
  const session = await getSession()
  const stats = await getMyDashboardStatsForUser(session!.id)
  const roomUnits = await getAllRoomUnits()
  const name = session!.fullName ?? t('housekeeper.title')

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {greeting(t)}, {name}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{t('housekeeper.shiftProgress')}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">{t('housekeeper.roomsToClean')}</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.roomsToClean}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">{t('housekeeper.shiftProgress')}</p>
          <ShiftProgress percent={stats.shiftProgress} />
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">{t('housekeeper.myTasks')}</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.myTasksCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">{t('housekeeper.pendingMaintenance')}</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.maintenanceOpenCount}</p>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialIcon name="priority_high" size={24} className="text-error" />
            {t('housekeeper.tasksPage.priorityUrgent')}
          </h2>
        </div>
        {stats.priorityTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No urgent tasks right now</p>
        ) : (
          <div className="space-y-3">
            {stats.priorityTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <MaterialIcon name="task_alt" size={24} />
          {t('housekeeper.tasksPage.myTasks')}
        </h2>
        {stats.activeTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No active tasks</p>
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