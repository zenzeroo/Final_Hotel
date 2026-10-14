import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { TaskClaimButton } from './TaskClaimButton'
import { TaskActions } from './TaskActions'
import { TaskETA } from './TaskETA'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateTime, formatBangkokDate, formatBangkokTime } from '@/lib/dates'
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
  /** Phase 30 — locale for next-check-in time formatting. */
  localeBcp?: string
  /**
   * Phase 53 — i18n labels for the "Started" / "Finished" prefix on
   * the time row. Required for `my` + `history` variants. The
   * `unassigned` variant passes empty strings (the times row is not
   * rendered for unassigned, so the labels are unused).
   */
  labels: { started: string; finished: string }
}

export function TaskCard({ task, variant = 'my', localeBcp, labels }: Props) {
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
        {/* Phase 30 — ETA pill (estimated minutes + urgent next-check-in warning). */}
        <TaskETA
          estimatedMinutes={task.estimated_minutes ?? null}
          nextCheckIn={task.next_check_in ?? null}
          localeBcp={localeBcp}
        />
        {/* Phase 53 — date + start/end times. Always show both times
            (with "—" fallback when null) so the user sees the full
            timespan even for tasks that were completed without a start
            (e.g. manager-completed inspection tasks via markInspected).
            The date uses the Asia/Bangkok + Gregorian formatter so
            server and client render identical strings. */}
        {variant !== 'unassigned' && (
          <div className="flex flex-col gap-1 mt-3 text-caption text-on-surface-variant">
            <span>
              {formatBangkokDate(
                task.completed_at ?? task.started_at ?? task.created_at,
                localeBcp as 'th-TH' | 'en-GB',
              )}
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="play_arrow" size={14} />
                <span>{labels.started}</span>
                <span className="font-mono">
                  {task.started_at
                    ? formatBangkokTime(task.started_at, localeBcp as 'th-TH' | 'en-GB')
                    : '—'}
                </span>
              </span>
              <span className="text-outline-variant" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MaterialIcon name="check" size={14} />
                <span>{labels.finished}</span>
                <span className="font-mono">
                  {task.completed_at
                    ? formatBangkokTime(task.completed_at, localeBcp as 'th-TH' | 'en-GB')
                    : '—'}
                </span>
              </span>
            </div>
          </div>
        )}
        {variant === 'unassigned' && (
          <div className="flex items-center gap-4 mt-3 text-caption text-on-surface-variant">
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" size={14} />
              {formatDateTime(task.created_at)}
            </span>
          </div>
        )}
      </div>
      {variant === 'unassigned' && <TaskClaimButton taskId={task.id} />}
      {variant === 'my' && <TaskActions taskId={task.id} status={task.status} />}
    </div>
  )
}