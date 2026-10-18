import type { UnassignedTask, HousekeeperOption } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AssignTaskButton } from '@/components/housekeeping/AssignTaskButton'
import { TASK_TYPE_KEY, timeAgo } from '@/components/housekeeping/labels'

interface UnassignedTaskListProps {
  tasks: UnassignedTask[]
  housekeepers: HousekeeperOption[]
  locale: Locale
}

export function UnassignedTaskList({ tasks, housekeepers, locale }: UnassignedTaskListProps) {
  const t = getT(locale)
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
        {t('manager.housekeepingPage.unassignedTasks')}
      </h3>
      {tasks.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">
          {t('manager.housekeepingPage.allTasksAssigned')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-3 border-b border-outline-variant pb-3 last:border-b-0 last:pb-0"
            >
              <MaterialIcon
                name={task.urgent ? 'priority_high' : 'checklist'}
                size={20}
                className={task.urgent ? 'text-error mt-0.5' : 'text-on-surface-variant mt-0.5'}
              />
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-semibold text-primary">{t(TASK_TYPE_KEY[task.taskType])}</p>
                <p className="text-caption text-on-surface-variant">
                  {t('manager.housekeepingPage.roomN', { room: task.roomNumber })} ·{' '}
                  {timeAgo(task.requestedAt, locale)}
                </p>
              </div>
              <div className="flex-shrink-0">
                <AssignTaskButton
                  taskId={task.id}
                  housekeepers={housekeepers}
                  currentAssigneeId={null}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
