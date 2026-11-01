import { getSession } from '@/lib/supabase/getSession'
import { getMyTasksForUser, getUnassignedTasks } from '@/lib/data/housekeeper'
import { getNextCheckInForRooms } from '@/lib/data/manager'
import { getLocale } from '@/lib/i18n/getLocale'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { HousekeeperMyTasksTabs } from '@/components/housekeeping/HousekeeperMyTasksTabs'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { inWorkingOrder } from '@/lib/housekeeping/order'

export const dynamic = 'force-dynamic'

type Tab = 'mine' | 'unassigned'

export default async function MyTasksPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await props.searchParams
  const tab: Tab = (['mine', 'unassigned'] as Tab[]).includes((params.tab as Tab) ?? 'mine')
    ? ((params.tab as Tab) ?? 'mine')
    : 'mine'

  const session = await getSession()
  const locale = await getLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const t = getT(locale)

  const [myTasks, unassigned] = await Promise.all([
    getMyTasksForUser(session!.id),
    getUnassignedTasks(),
  ])

  // Phase 30 — merge next-check-in ETA into each task from the view.
  const allRoomUnitIds = [
    ...myTasks.map(t => t.room_unit_id),
    ...unassigned.map(t => t.room_unit_id),
  ]
  const uniqueRoomIds = [...new Set(allRoomUnitIds)]
  const nextCheckInMap = await getNextCheckInForRooms(uniqueRoomIds)
  const attachEta = (t: typeof myTasks[number]) => ({
    ...t,
    next_check_in: nextCheckInMap.get(t.room_unit_id) ?? null,
  })
  const myTasksWithEta = inWorkingOrder(myTasks.map(attachEta))
  const unassignedWithEta = inWorkingOrder(unassigned.map(attachEta))

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12 max-w-6xl">
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">{t('housekeeper.tasksPage.heading')}</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">{t('housekeeper.tasksPage.subtitle')}</p>
      </header>

      <HousekeeperMyTasksTabs
        active={tab}
        mineCount={myTasks.length}
        unassignedCount={unassigned.length}
      />

      {tab === 'mine' ? (
        <section>
          <h2 className="sr-only">
            {t('housekeeper.tasksPage.mineHeading', { count: myTasksWithEta.length })}
          </h2>
          {myTasksWithEta.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-10 text-center">
              <MaterialIcon name="task_alt" size={48} className="text-on-surface-variant" />
              <p className="font-display text-xl text-primary">{t('housekeeper.tasksPage.mineEmpty')}</p>
              <p className="text-body-md text-on-surface-variant">
                {t('housekeeper.tasksPage.mineEmptyHintBefore')}{' '}
                <a href="/housekeeper/tasks?tab=unassigned" className="text-primary underline">
                  &quot;{t('housekeeper.tasksPage.tabPool')}&quot;
                </a>{' '}
                {t('housekeeper.tasksPage.mineEmptyHintAfter')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {myTasksWithEta.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="my"
                  localeBcp={localeBcp}
                  labels={{ started: t('housekeeper.tasks.started'), finished: t('housekeeper.tasks.finished') }}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <h2 className="sr-only">
            {t('housekeeper.tasksPage.poolHeading', { count: unassignedWithEta.length })}
          </h2>
          {unassignedWithEta.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-10 text-center">
              <MaterialIcon name="check_circle" size={48} className="text-primary" />
              <p className="font-display text-xl text-primary">{t('housekeeper.tasksPage.poolEmpty')}</p>
              <p className="text-body-md text-on-surface-variant">
                {t('housekeeper.tasksPage.poolEmptyHint')}{' '}
                <a href="/housekeeper/tasks?tab=mine" className="text-primary underline">
                  &quot;{t('housekeeper.tasksPage.tabMine')}&quot;
                </a>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {unassignedWithEta.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  variant="unassigned"
                  localeBcp={localeBcp}
                  labels={{ started: '', finished: '' }}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
