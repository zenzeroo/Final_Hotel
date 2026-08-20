import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { TaskClaimButton } from './TaskClaimButton'
import { TaskActions } from './TaskActions'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { HousekeepingTask } from '@/lib/data/types'

const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  turn_down: 'Turn-down',
  deep_clean: 'Deep Clean',
  inspection: 'Inspection',
  restock: 'Restock',
}

interface Props {
  task: HousekeepingTask
  variant?: 'my' | 'unassigned' | 'history'
}

export function TaskCard({ task, variant = 'my' }: Props) {
  const unit = task.room_unit
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="font-headline-sm text-headline-sm text-primary">
            {unit ? `Room ${unit.unit_label}` : `Unit ${task.room_unit_id}`}
          </h4>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        <p className="text-body-md text-on-surface-variant">
          {TASK_TYPE_LABELS[task.task_type] ?? task.task_type}
          {unit?.view_label ? ` · ${unit.view_label}` : ''}
          {unit?.room_type?.name ? ` · ${unit.room_type.name}` : ''}
        </p>
        {task.notes && (
          <p className="text-caption text-on-surface-variant mt-2 italic">&ldquo;{task.notes}&rdquo;</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-caption text-on-surface-variant">
          {task.started_at && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="play_arrow" size={14} />
              {new Date(task.started_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {task.completed_at && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="check" size={14} />
              {new Date(task.completed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {variant === 'unassigned' && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" size={14} />
              {new Date(task.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>
      </div>
      {variant === 'unassigned' && <TaskClaimButton taskId={task.id} />}
      {variant === 'my' && <TaskActions taskId={task.id} status={task.status} />}
    </div>
  )
}