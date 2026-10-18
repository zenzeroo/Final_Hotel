import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getHousekeeperDetail, listHousekeepers } from '@/lib/data/manager'
import { isUuid } from '@/lib/ids'
import { formatBangkokTime } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PriorityBadge } from '@/components/housekeeping/PriorityBadge'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import { ReassignTaskButton } from '@/components/housekeeping/ReassignTaskButton'
import { TaskETA } from '@/components/housekeeping/TaskETA'
import { WorkloadBar } from '@/components/housekeeping/WorkloadBar'
import { TASK_TYPE_KEY } from '@/components/housekeeping/labels'
import { shiftLabelWithHours } from '@/components/manager/shiftMeta'
import type { HousekeeperDetailTask } from '@/lib/data/types'

export const dynamic = 'force-dynamic'

const CAPACITY_MINUTES = 480

/**
 * Phase 54 — per-housekeeper detail for managers: every task they still
 * have to do (with ETA / next check-in / reassign) plus what they finished
 * today. Linked from the summary cards on /manager/housekeeping.
 */
export default async function HousekeeperDetailPage(props: PageProps<'/manager/housekeeping/staff/[id]'>) {
  const { id } = await props.params
  if (!isUuid(id)) notFound()

  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = locale === 'en' ? 'en-GB' : 'th-TH'
  const [detail, housekeepers] = await Promise.all([getHousekeeperDetail(id), listHousekeepers()])
  if (!detail) notFound()

  const roomType = (task: HousekeeperDetailTask) =>
    locale === 'th' ? (task.roomTypeNameTh ?? task.roomTypeName) : task.roomTypeName
  const inProgress = detail.openTasks.filter((task) => task.status === 'in_progress').length

  return (
    <div className="p-8 lg:p-12 max-w-5xl">
      <Link
        href="/manager/housekeeping"
        className="inline-flex items-center gap-1 text-caption text-on-surface-variant hover:text-primary transition-colors duration-200 mb-4"
      >
        <MaterialIcon name="arrow_back" size={16} />
        {t('manager.housekeepingPage.backToOverview')}
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">{detail.fullName}</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          {t('manager.housekeepingPage.detailSubtitle')}
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-caption font-medium ${
              detail.isOnShift ? 'bg-secondary/15 text-secondary' : 'bg-on-surface-variant/20 text-on-surface-variant'
            }`}
          >
            <MaterialIcon name={detail.isOnShift ? 'check_circle' : 'event_busy'} size={14} />
            {detail.shiftPosition
              ? t('manager.housekeepingPage.shiftToday', { shift: shiftLabelWithHours(t, detail.shiftPosition) })
              : t('manager.housekeepingPage.shiftStatus.offDuty')}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-caption bg-surface-container-low text-on-surface-variant">
            <MaterialIcon name="layers" size={14} />
            {detail.floors.length > 0
              ? t('manager.housekeepingPage.floorsLabel', { floors: detail.floors.join(', ') })
              : t('manager.housekeepingPage.noFloors')}
          </span>
        </div>
        <div className="mt-4 max-w-md">
          <WorkloadBar
            loadMinutes={detail.loadMinutes}
            capacityMinutes={detail.isOnShift ? CAPACITY_MINUTES : 0}
            label={
              detail.isOnShift
                ? t('manager.housekeepingPage.loadOfCapacity', {
                    load: detail.loadMinutes,
                    capacity: CAPACITY_MINUTES,
                    percent: Math.min(100, Math.round((detail.loadMinutes / CAPACITY_MINUTES) * 100)),
                  })
                : t('manager.housekeepingPage.offShiftLoad', { load: detail.loadMinutes })
            }
          />
        </div>
      </header>

      <section className="mb-10">
        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-headline-sm text-headline-sm text-primary">
            {t('manager.housekeepingPage.openTasksTitle', { count: detail.openTasks.length })}
          </h2>
          {detail.openTasks.length > 0 && (
            <p className="text-caption text-on-surface-variant">
              {t('manager.housekeepingPage.inProgressN', { count: inProgress })} ·{' '}
              {t('manager.housekeepingPage.notStartedN', { count: detail.openTasks.length - inProgress })}
            </p>
          )}
        </div>
        {detail.openTasks.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
            <p className="text-body-md text-on-surface-variant italic">
              {t('manager.housekeepingPage.noOpenTasks')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.openTasks.map((task) => (
              <li
                key={task.id}
                className={`bg-surface-container-lowest rounded-lg shadow-level-1 p-5 flex items-start gap-4 border-l-4 ${
                  task.status === 'in_progress' ? 'border-secondary' : 'border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline-sm text-headline-sm text-primary leading-none">
                      {task.roomNumber}
                    </span>
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-body-md text-on-surface mt-2">
                    {t(TASK_TYPE_KEY[task.taskType])} · {roomType(task)} ·{' '}
                    {t('manager.housekeepingPage.floorN', { floor: task.floor })}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap mt-2">
                    <TaskETA
                      estimatedMinutes={task.estimatedMinutes}
                      nextCheckIn={task.nextCheckIn}
                      localeBcp={localeBcp}
                    />
                    {task.startedAt && (
                      <span className="text-caption text-on-surface-variant">
                        {t('manager.housekeepingPage.startedAt', {
                          time: formatBangkokTime(task.startedAt, localeBcp),
                        })}
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="text-caption text-on-surface-variant mt-2 italic">{task.notes}</p>
                  )}
                </div>
                {task.status === 'assigned' && (
                  <ReassignTaskButton
                    taskId={task.id}
                    housekeepers={housekeepers}
                    currentAssigneeId={detail.id}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('manager.housekeepingPage.completedTodayTitle', { count: detail.completedToday.length })}
        </h2>
        {detail.completedToday.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
            <p className="text-body-md text-on-surface-variant italic">
              {t('manager.housekeepingPage.noCompletedToday')}
            </p>
          </div>
        ) : (
          <ul className="bg-surface-container-lowest rounded-lg shadow-level-1 divide-y divide-outline-variant">
            {detail.completedToday.map((task) => {
              const start = task.startedAt ?? task.createdAt
              const minutes = task.completedAt
                ? Math.max(0, Math.round((new Date(task.completedAt).getTime() - new Date(start).getTime()) / 60000))
                : 0
              return (
                <li key={task.id} className="flex items-center gap-4 px-5 py-3">
                  <MaterialIcon name="task_alt" size={20} className="text-secondary shrink-0" />
                  <span className="font-body-md font-semibold text-primary w-16 shrink-0">{task.roomNumber}</span>
                  <span className="flex-1 min-w-0 text-body-md text-on-surface truncate">
                    {t(TASK_TYPE_KEY[task.taskType])} · {roomType(task)}
                  </span>
                  {task.completedAt && (
                    <span className="text-caption text-on-surface-variant whitespace-nowrap">
                      {t('manager.housekeepingPage.timeRange', {
                        start: formatBangkokTime(start, localeBcp),
                        end: formatBangkokTime(task.completedAt, localeBcp),
                        minutes,
                      })}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
