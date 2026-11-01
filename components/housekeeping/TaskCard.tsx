import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { TaskClaimButton } from './TaskClaimButton'
import { TaskActions } from './TaskActions'
import { TaskETA } from './TaskETA'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatDateTime, formatBangkokDate, formatBangkokTime } from '@/lib/dates'
import type { HousekeepingTask } from '@/lib/data/types'
import { getT } from '@/lib/i18n/t'
import { TASK_TYPE_KEY } from './labels'
import { localizedName } from '@/lib/format/roomType'

interface Props {
  task: HousekeepingTask
  variant?: 'my' | 'unassigned'
  /** Phase 30 — locale for next-check-in time formatting. */
  localeBcp?: string
  /**
   * Phase 53 — i18n labels for the "Started" / "Finished" prefix on
   * the time row. Required for the `my` variant. The
   * `unassigned` variant passes empty strings (the times row is not
   * rendered for unassigned, so the labels are unused).
   */
  labels: { started: string; finished: string }
}

export function TaskCard({ task, variant = 'my', localeBcp, labels }: Props) {
  const unit = task.room_unit
  const locale = localeBcp?.startsWith('en') ? 'en' : 'th'
  const t = getT(locale)
  const bcp = (localeBcp ?? 'th-TH') as 'th-TH' | 'en-GB'
  // Times only once something has happened; an unstarted task shows none.
  const showTimes = Boolean(task.started_at || task.completed_at)
  const meta = [
    TASK_TYPE_KEY[task.task_type] ? t(TASK_TYPE_KEY[task.task_type]) : task.task_type,
    unit?.room_type ? localizedName(unit.room_type, locale) : null,
    unit?.floor != null ? `${t('roomDetail.floor')} ${unit.floor}` : null,
    unit?.view_label ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display text-2xl leading-[1.2] text-primary">
            {t('staff.roomN', { room: unit?.unit_label ?? task.room_unit_id })}
          </h3>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        <p className="mt-1 text-body-md text-on-surface">{meta}</p>
        {/* Phase 30 — estimated minutes + urgent next-check-in warning. */}
        <TaskETA
          estimatedMinutes={task.estimated_minutes ?? null}
          nextCheckIn={task.next_check_in ?? null}
          localeBcp={localeBcp}
        />
        {task.notes && (
          <p className="mt-3 px-4 py-3 rounded-xl bg-surface-container-low text-body-md text-on-surface">{task.notes}</p>
        )}
      </div>

      <div className="mt-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="text-[14px] text-on-surface-variant tabular-nums">
          {variant === 'unassigned' ? (
            <span className="inline-flex items-center gap-1">
              <MaterialIcon name="schedule" size={16} />
              {formatDateTime(task.created_at, localeBcp)}
            </span>
          ) : showTimes ? (
            // Phase 53 — date + start/end times, "—" where a step was skipped
            // (e.g. inspections a manager completed without a start).
            <>
              <span>{formatBangkokDate(task.completed_at ?? task.started_at ?? task.created_at, bcp)}</span>
              <span className="block">
                {labels.started} {task.started_at ? formatBangkokTime(task.started_at, bcp) : '—'}
                {' · '}
                {labels.finished} {task.completed_at ? formatBangkokTime(task.completed_at, bcp) : '—'}
              </span>
            </>
          ) : (
            <span>{formatBangkokDate(task.created_at, bcp)}</span>
          )}
        </div>
        {variant === 'unassigned' && <TaskClaimButton taskId={task.id} />}
        {variant === 'my' && <TaskActions taskId={task.id} status={task.status} />}
      </div>
    </article>
  )
}
