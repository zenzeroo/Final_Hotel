import { getSession } from '@/lib/supabase/getSession'
import { getMyWorkHistoryForUser } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Phase 53 — full i18n + Bangkok-anchored date/time + 3-col stat layout.
 * Always shows the current user's own work. The previous "All hotel"
 * scope (via `?scope=all` + admin role check) was removed per request
 * — `/housekeeper/history` is now single-user-only. Managers / all-hotel
 * oversight belongs on `/manager/housekeeping` (separate page).
 */
export default async function WorkHistoryPage() {
  const session = await getSession()
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = (locale === 'en' ? 'en-GB' : 'th-TH') as 'th-TH' | 'en-GB'

  const data = await getMyWorkHistoryForUser(session!.id)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          {t('housekeeper.historyPage.pageTitle')}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {t('housekeeper.historyPage.pageSubtitle')}
        </p>
      </header>

      {/* 3 stat cards — 1-col on mobile, 3-col on md+ */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            {t('housekeeper.historyPage.roomsCleaned')}
          </p>
          <p className="font-display-lg text-display-lg text-primary">{data.roomsCleaned}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            {t('housekeeper.historyPage.tasksToday')}
          </p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksToday}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2">
            {t('housekeeper.historyPage.tasksThisWeek')}
          </p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksThisWeek}</p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('housekeeper.historyPage.recentLogTitle')}
        </h2>
        {data.recentLog.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">
            {t('housekeeper.historyPage.noLog')}
          </p>
        ) : (
          <div className="space-y-3">
            {data.recentLog.map((taskItem) => (
              <TaskCard
                key={taskItem.id}
                task={taskItem}
                variant="history"
                localeBcp={localeBcp}
                labels={{
                  started: t('housekeeper.historyPage.started'),
                  finished: t('housekeeper.historyPage.finished'),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
