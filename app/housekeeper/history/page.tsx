import { getSession } from '@/lib/supabase/getSession'
import { getMyWorkHistoryForUser } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { bangkokMonthRange, getTodayBangkok } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * Phase 53b — month picker (URL state via `?month=YYYY-MM`).
 * Default = current month (Bangkok). The list + `roomsCleaned` stat
 * are scoped to the selected month; `tasksToday` + `tasksThisWeek`
 * stay date-relative to today so the user can see "this month" vs.
 * "today" side-by-side.
 */
export default async function WorkHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = (locale === 'en' ? 'en-GB' : 'th-TH') as 'th-TH' | 'en-GB'

  // Phase 53b — parse `?month=YYYY-MM`. If absent or malformed (incl.
  // out-of-range months like `2026-13`), default to the current Bangkok
  // month. Bounds are Bangkok-anchored timestamps so tasks completed at
  // 00:00-06:59 on the 1st land in the right month.
  const fallbackMonth = getTodayBangkok().slice(0, 7)
  const monthRaw = typeof params.month === 'string' ? params.month : ''
  const monthIsValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw)
  const month = monthIsValid ? monthRaw : fallbackMonth
  const { from: monthFrom, toExclusive: monthToExclusive } = bangkokMonthRange(month)

  const data = await getMyWorkHistoryForUser(session!.id, {
    monthFrom,
    monthToExclusive,
  })

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">
            {t('housekeeper.historyPage.pageTitle')}
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            {t('housekeeper.historyPage.pageSubtitle')}
          </p>
        </div>
        {/*
          Phase 53b — month picker. Native `<input type="month">` (HTML5),
          no client JS. Form submits via GET so the page re-renders with
          the new `?month=…` param. The "Clear" link drops the param
          (returns to the default = current month).
        */}
        <form
          method="get"
          className="flex items-center gap-2"
        >
          <label
            htmlFor="month"
            className="text-caption text-on-surface-variant uppercase tracking-wider"
          >
            {t('housekeeper.historyPage.monthPickerLabel')}
          </label>
          <input
            type="month"
            id="month"
            name="month"
            defaultValue={month}
            className="bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-body-md text-on-surface"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
          >
            {t('housekeeper.historyPage.monthPickerApply')}
          </button>
          {monthIsValid && (
            <a
              href="/housekeeper/history"
              className="px-3 py-2 rounded-lg text-caption text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-colors"
            >
              {t('housekeeper.historyPage.monthPickerClear')}
            </a>
          )}
        </form>
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
            {monthIsValid
              ? t('housekeeper.historyPage.emptyMonth')
              : t('housekeeper.historyPage.noLog')}
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
