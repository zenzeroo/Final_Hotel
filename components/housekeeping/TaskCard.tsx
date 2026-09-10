import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { TaskClaimButton } from './TaskClaimButton'
import { TaskActions } from './TaskActions'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateTime, formatTime } from '@/lib/dates'
import type { HousekeepingTask } from '@/lib/data/types'

const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: 'ทำความสะอาด',
  turn_down: 'เตรียมห้อง',
  deep_clean: 'ทำความสะอาดลึก',
  inspection: 'ตรวจสอบ',
  restock: 'เติมสิ่งของ',
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
            {unit ? `ห้อง ${unit.unit_label}` : `Unit ${task.room_unit_id}`}
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
              {formatTime(task.started_at)}
            </span>
          )}
          {task.completed_at && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="check" size={14} />
              {formatTime(task.completed_at)}
            </span>
          )}
          {variant === 'unassigned' && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" size={14} />
              {formatDateTime(task.created_at)}
            </span>
          )}
        </div>
      </div>
      {variant === 'unassigned' && <TaskClaimButton taskId={task.id} />}
      {variant === 'my' && <TaskActions taskId={task.id} status={task.status} />}
    </div>
  )
}