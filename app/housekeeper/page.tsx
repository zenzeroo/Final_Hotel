import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { PriorityBadge } from '@/components/housekeeping/PriorityBadge'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import { TaskActions } from '@/components/housekeeping/TaskActions'
import { TaskETA } from '@/components/housekeeping/TaskETA'
import { TASK_TYPE_KEY } from '@/components/housekeeping/labels'
import { localizedName } from '@/lib/format/roomType'
import type { HousekeepingTask } from '@/lib/data/types'
import { inWorkingOrder } from '@/lib/housekeeping/order'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

function greeting(t: ReturnType<typeof getT>): string {
  const h = new Date().getHours()
  if (h < 12) return t('manager.greetingMorning')
  if (h < 18) return t('manager.greetingAfternoon')
  return t('manager.greetingEvening')
}

/**
 * Housekeeper dashboard, built for a phone in the hand: the one task to do
 * next with a full-width start/finish button, today's figures, and the rest
 * of my tasks as a short list. The full list (incl. unclaimed tasks) lives
 * on /housekeeper/tasks only.
 */
export default async function HousekeeperDashboard() {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = locale === 'en' ? 'en-GB' : 'th-TH'
  const session = await getSession()
  const [stats, roomUnits] = await Promise.all([getMyDashboardStatsForUser(session!.id), getAllRoomUnits()])
  const name = session!.fullName ?? t('housekeeper.title')
  const [next, ...rest] = inWorkingOrder(stats.activeTasks)
  const others = rest.slice(0, 4)

  const taskLine = (task: HousekeepingTask) => {
    const unit = task.room_unit
    return [
      TASK_TYPE_KEY[task.task_type] ? t(TASK_TYPE_KEY[task.task_type]) : task.task_type,
      unit?.room_type ? localizedName(unit.room_type, locale) : null,
      unit?.floor != null ? `${t('roomDetail.floor')} ${unit.floor}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const figures = [
    { label: t('housekeeper.myTasks'), value: stats.myTasksCount, href: '/housekeeper/tasks' },
    { label: t('housekeeper.dashboard.urgentWaiting'), value: stats.priorityTasksCount, href: '/housekeeper/tasks' },
    { label: t('housekeeper.roomsToClean'), value: stats.roomsToClean, href: '/housekeeper/rooms' },
    { label: t('housekeeper.pendingMaintenance'), value: stats.maintenanceOpenCount, href: '/housekeeper/maintenance' },
  ]

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12 max-w-6xl">
      <header className="mb-6 md:mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
            {greeting(t)}, {name}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {new Intl.DateTimeFormat(localeBcp, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Bangkok' }).format(new Date())}
          </p>
        </div>
        <MaintenanceReportModal roomUnits={roomUnits} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-stretch">
        {/* The one thing to do next. */}
        <section aria-labelledby="next-task" className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 flex flex-col">
          <h2 id="next-task" className="text-[14px] font-semibold text-on-surface-variant">
            {next?.status === 'in_progress' ? t('housekeeper.dashboard.inProgress') : t('housekeeper.dashboard.nextTask')}
          </h2>
          {next ? (
            <>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <p className="font-display text-[40px] leading-[1.1] text-primary">
                  {t('staff.roomN', { room: next.room_unit?.unit_label ?? next.room_unit_id })}
                </p>
                <PriorityBadge priority={next.priority} />
                <StatusBadge status={next.status} />
              </div>
              <p className="mt-2 text-body-lg text-on-surface">{taskLine(next)}</p>
              <TaskETA
                estimatedMinutes={next.estimated_minutes ?? null}
                nextCheckIn={next.next_check_in ?? null}
                localeBcp={localeBcp}
              />
              {next.notes && (
                <p className="mt-4 px-4 py-3 rounded-xl bg-surface-container-low text-body-md text-on-surface">{next.notes}</p>
              )}
              <div className="mt-auto pt-6">
                <TaskActions taskId={next.id} status={next.status} size="lg" />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-2xl leading-[1.3] text-primary">{t('housekeeper.dashboard.noNextTask')}</p>
              <p className="mt-2 mb-6 text-body-md text-on-surface">{t('housekeeper.dashboard.noNextTaskBody')}</p>
              <Link
                href="/housekeeper/tasks"
                className="mt-auto self-start inline-flex items-center justify-center w-full sm:w-auto h-12 px-6 rounded-xl bg-primary text-on-primary font-semibold text-body-md hover:bg-primary-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('housekeeper.dashboard.openTasks')}
              </Link>
            </>
          )}
        </section>

        {/* Today's figures as type, each opening the list it counts. */}
        <section aria-labelledby="today" className="bg-surface-container-lowest rounded-2xl p-6 md:p-8">
          <h2 id="today" className="text-[14px] font-semibold text-on-surface-variant mb-3">
            {t('housekeeper.dashboard.today')} · {t('housekeeper.shiftProgress')}
          </h2>
          <ShiftProgress percent={stats.shiftProgress} />
          <dl className="mt-6 flex flex-col">
            {figures.map((f) => (
              <div key={f.label} className="border-t border-surface-container first:border-t-0">
                <Link
                  href={f.href}
                  className="flex items-center justify-between gap-4 min-h-12 py-2 text-on-surface hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  <dt className="text-body-md">{f.label}</dt>
                  <dd className="font-display text-2xl text-primary tabular-nums">{f.value}</dd>
                </Link>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* The rest of my tasks, short; the full list is on /housekeeper/tasks. */}
      {others.length > 0 && (
        <section aria-labelledby="other-tasks" className="mt-6 bg-surface-container-lowest rounded-2xl p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 id="other-tasks" className="font-display text-xl text-primary">{t('housekeeper.dashboard.otherTasks')}</h2>
            <Link href="/housekeeper/tasks" className="text-body-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">
              {t('housekeeper.dashboard.seeAll')} ({stats.activeTasks.length})
            </Link>
          </div>
          <ul className="flex flex-col">
            {others.map((task) => (
              <li key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-t border-surface-container first:border-t-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-body-lg font-semibold text-primary">
                      {t('staff.roomN', { room: task.room_unit?.unit_label ?? task.room_unit_id })}
                    </p>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <p className="text-[14px] text-on-surface-variant mt-0.5">{taskLine(task)}</p>
                </div>
                <TaskActions taskId={task.id} status={task.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
