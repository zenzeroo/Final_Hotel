/**
 * Phase 54 — compact per-housekeeper summary cards. The full task list
 * (ETA, next check-in, reassign) lives on the detail page
 * `/manager/housekeeping/staff/[id]`, linked from each card.
 */
import Link from 'next/link'
import type { AssignedTaskCard, HousekeeperCard as HousekeeperCardData } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { WorkloadBar } from '@/components/housekeeping/WorkloadBar'

const CAPACITY_MINUTES = 480

interface HousekeeperCardsProps {
  cards: HousekeeperCardData[]
  /** Housekeepers on shift today; off-shift cards show load without a capacity. */
  onShiftIds: string[]
  /** Persisted floor defaults per housekeeper id. */
  floorsByHousekeeper: Record<string, number[]>
  locale: Locale
}

export function HousekeeperCards({ cards, onShiftIds, floorsByHousekeeper, locale }: HousekeeperCardsProps) {
  const t = getT(locale)
  const onShift = new Set(onShiftIds)
  return (
    <section className="mb-12">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
        {t('manager.housekeepingPage.housekeeperCards')}
      </h3>
      {cards.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="text-body-md text-on-surface-variant italic">
            {t('manager.housekeepingPage.noAssignedTasks')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => {
            const load = card.totalLoadMinutes ?? 0
            const isOnShift = onShift.has(card.housekeeperId)
            const floors = floorsByHousekeeper[card.housekeeperId] ?? []
            const inProgress = card.tasks.filter((task) => task.status === 'in_progress').length
            return (
              <div
                key={card.housekeeperId}
                className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 flex flex-col gap-4"
              >
                <header className="flex items-start gap-3">
                  <MaterialIcon name="person" size={24} className="text-secondary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-body-lg font-semibold text-primary truncate">{card.fullName}</p>
                    <p className="text-caption text-on-surface-variant">
                      {floors.length > 0
                        ? t('manager.housekeepingPage.floorsLabel', { floors: floors.join(', ') })
                        : t('manager.housekeepingPage.noFloors')}
                    </p>
                  </div>
                </header>

                <p className="text-body-md text-on-surface">
                  <span className="font-semibold">
                    {t('manager.housekeepingPage.tasksCount', { count: card.tasks.length })}
                  </span>
                  <span className="text-caption text-on-surface-variant">
                    {' · '}
                    {t('manager.housekeepingPage.inProgressN', { count: inProgress })} ·{' '}
                    {t('manager.housekeepingPage.notStartedN', { count: card.tasks.length - inProgress })}
                  </span>
                </p>

                <WorkloadBar
                  loadMinutes={load}
                  capacityMinutes={isOnShift ? CAPACITY_MINUTES : 0}
                  label={
                    isOnShift
                      ? t('manager.housekeepingPage.loadOfCapacity', {
                          load,
                          capacity: CAPACITY_MINUTES,
                          percent: card.workloadPercent ?? 0,
                        })
                      : t('manager.housekeepingPage.offShiftLoad', { load })
                  }
                />

                <Link
                  href={`/manager/housekeeping/staff/${card.housekeeperId}`}
                  className="mt-auto inline-flex items-center justify-center gap-1 px-4 py-2 rounded-md border border-outline-variant text-caption uppercase tracking-wider text-primary hover:bg-primary hover:text-on-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  {t('manager.housekeepingPage.viewDetails')}
                  <MaterialIcon name="arrow_forward" size={16} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// Re-export types so consumers can import from this file.
export type { AssignedTaskCard }
