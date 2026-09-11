import type { AssignedTaskCard, HousekeeperCard as HousekeeperCardData, HousekeeperOption } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PriorityBadge } from '@/components/housekeeping/PriorityBadge'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import { ReassignTaskButton } from '@/components/housekeeping/ReassignTaskButton'
import { WorkloadBar } from '@/components/housekeeping/WorkloadBar'
import { formatDistanceToNow } from 'date-fns'

interface HousekeeperCardsProps {
  cards: HousekeeperCardData[]
  housekeepers: HousekeeperOption[]
}

export function HousekeeperCards({ cards, housekeepers }: HousekeeperCardsProps) {
  return (
    <section className="mb-12">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
        งานของแม่บ้านแต่ละคน
      </h3>
      {cards.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-body-md text-on-surface-variant italic">ไม่มีงานที่มอบหมายแล้ว</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.housekeeperId}
              className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6"
            >
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="person" size={24} className="text-secondary" />
                  <div>
                    <p className="font-body-lg font-semibold text-primary">{card.fullName}</p>
                    <p className="text-caption text-on-surface-variant">
                      {card.tasks.length} งานที่กำลังดำเนินการ
                    </p>
                  </div>
                </div>
              </header>
              {/* Phase 30 — workload bar (8h shift = 480 min capacity). */}
              <div className="mb-4">
                <WorkloadBar
                  loadMinutes={card.totalLoadMinutes ?? 0}
                  capacityMinutes={card.workloadPercent && card.workloadPercent > 0 ? 480 : 0}
                  label={
                    card.workloadPercent !== undefined
                      ? `${card.totalLoadMinutes ?? 0} / 480 นาที (${card.workloadPercent}%)`
                      : `${card.totalLoadMinutes ?? 0} นาที`
                  }
                />
              </div>
              <ul className="flex flex-col gap-3">
                {card.tasks.map((t) => (
                  <li
                    key={t.taskId}
                    className="flex items-start gap-3 border-b border-outline-variant pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body-md font-semibold text-primary">
                          ห้อง {t.roomNumber}
                        </span>
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {t.taskType.replace(/_/g, ' ')} · ชั้น {t.floor} ·{' '}
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </p>
                      {t.notes && (
                        <p className="text-caption text-on-surface-variant mt-1 italic">
                          {t.notes}
                        </p>
                      )}
                    </div>
                    <ReassignTaskButton
                      taskId={t.taskId}
                      housekeepers={housekeepers}
                      currentAssigneeId={t.assignedToId}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Re-export types so consumers can import from this file.
export type { AssignedTaskCard }