/**
 * Phase 30 — manager dashboard workload summary table.
 *
 * One row per housekeeper (role='housekeeper' + is_active=true):
 *   - name
 *   - availability chip (from `staff_shifts.position != 'off'` today)
 *   - task count + total estimated minutes
 *   - workload bar (`<WorkloadBar>`)
 *   - floor defaults (chips)
 *
 * Server component — receives `HousekeeperWorkload[]` from the page.
 */
import type { HousekeeperWorkload } from '@/lib/data/types'
import { WorkloadBar } from '@/components/housekeeping/WorkloadBar'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface HousekeeperWorkloadTableProps {
  workloads: HousekeeperWorkload[]
  /** Optional i18n translator from the page server component. */
  t: (key: string) => string
}

function availabilityChip(isAvailable: boolean, label: string, busyLabel: string, offLabel: string) {
  if (!isAvailable) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-medium bg-on-surface-variant/20 text-on-surface-variant">
        <MaterialIcon name="event_busy" size={12} />
        {offLabel}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-medium bg-secondary/15 text-secondary">
      <MaterialIcon name="check_circle" size={12} />
      {label}
    </span>
  )
}

export function HousekeeperWorkloadTable({ workloads, t }: HousekeeperWorkloadTableProps) {
  if (workloads.length === 0) {
    return (
      <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <p className="text-body-md text-on-surface-variant italic">
          {t('manager.housekeepingPage.noHousekeepersAvailable')}
        </p>
      </section>
    )
  }

  return (
    <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 mb-8">
      <header className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-primary">
          {t('manager.housekeepingPage.totalWorkload')}
        </h3>
      </header>
      <ul className="flex flex-col gap-4">
        {workloads.map((w) => {
          const availabilityLabel = t(`manager.housekeepingPage.shiftStatus.available`)
          const busyLabel = t(`manager.housekeepingPage.shiftStatus.busy`)
          const offLabel = t(`manager.housekeepingPage.shiftStatus.offDuty`)
          return (
            <li
              key={w.housekeeperId}
              className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 border-b border-outline-variant pb-4 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <MaterialIcon name="person" size={24} className="text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-body-md font-semibold text-primary truncate">{w.fullName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {availabilityChip(w.isAvailable, availabilityLabel, busyLabel, offLabel)}
                    <span className="text-caption text-on-surface-variant">
                      {w.taskCount} {t('manager.housekeepingPage.minutes') ? 'tasks' : 'งาน'}
                    </span>
                  </div>
                  {w.floorDefaults.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <MaterialIcon name="layers" size={12} className="text-on-surface-variant" />
                      <span className="text-caption text-on-surface-variant">
                        Floor {w.floorDefaults.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <WorkloadBar
                  loadMinutes={w.currentLoadMinutes}
                  capacityMinutes={w.capacityMinutes}
                  label={`${w.currentLoadMinutes} / ${w.capacityMinutes} ${t('manager.housekeepingPage.minutes')} (${w.workloadPercent}%)`}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}