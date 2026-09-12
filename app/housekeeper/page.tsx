import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { HousekeeperTasksTabs } from '@/components/housekeeping/HousekeeperTasksTabs'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type TasksTab = 'urgent' | 'assigned'

function greeting(t: ReturnType<typeof getT>): string {
  const h = new Date().getHours()
  if (h < 12) return t('manager.greetingMorning')
  if (h < 18) return t('manager.greetingAfternoon')
  return t('manager.greetingEvening')
}

/**
 * Phase 30.2 — Converted the "Urgent" + "Assigned to me" sections from
 * stacked `<section>` blocks to a single tabbed panel. URL search params
 * drive the active tab (matches BookingsOversightTabs / ReviewsTabs
 * pattern in `app/manager/**`). Default tab is `urgent` so the dashboard
 * still surfaces priority work first thing on landing.
 */
export default async function HousekeeperDashboard(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const tab: TasksTab = (['urgent', 'assigned'] as TasksTab[]).includes(
    (searchParams.tab as TasksTab) ?? 'urgent',
  )
    ? ((searchParams.tab as TasksTab) ?? 'urgent')
    : 'urgent'

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

      {/* Phase 30.2 — top tab strip + sibling panel pattern (mirrors
          app/manager/bookings/page.tsx:42-72). */}
      <HousekeeperTasksTabs
        active={tab}
        urgentCount={stats.priorityTasksCount}
        assignedCount={stats.activeTasks.length}
      />

      <section>
        {tab === 'urgent' ? (
          stats.priorityTasks.length === 0 ? (
            <p className="text-body-md text-on-surface-variant italic">
              {t('housekeeper.tabs.emptyUrgent')}
            </p>
          ) : (
            <div className="space-y-3">
              {stats.priorityTasks.map((task) => (
                <TaskCard key={task.id} task={task} variant="my" />
              ))}
            </div>
          )
        ) : null}

        {tab === 'assigned' ? (
          stats.activeTasks.length === 0 ? (
            <p className="text-body-md text-on-surface-variant italic">
              {t('housekeeper.tabs.emptyAssigned')}
            </p>
          ) : (
            <div className="space-y-3">
              {stats.activeTasks.map((task) => (
                <TaskCard key={task.id} task={task} variant="my" />
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="flex justify-end mt-12">
        <MaintenanceReportModal roomUnits={roomUnits} />
      </section>
    </div>
  )
}
