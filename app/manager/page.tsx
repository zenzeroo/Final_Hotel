import { getSession } from '@/lib/supabase/getSession'
import { getManagerActionQueue, getManagerDashboardStats, getReportsData, getTodayMovements } from '@/lib/data/manager'
import { ActionQueue } from '@/components/manager/ActionQueue'
import { TodayFigures } from '@/components/manager/TodayFigures'
import { WeekTrend } from '@/components/manager/WeekTrend'
import { TodayMovements } from '@/components/manager/TodayMovements'
import { Tabs } from '@/components/ui/Tabs'
import { actionKinds } from '@/lib/manager/action-queue'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { greeting } from '@/lib/i18n/greeting'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { addDaysIso, getTodayBangkok, parseReportRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const VIEWS = ['actions', 'today', 'movements', 'week'] as const
type View = (typeof VIEWS)[number]

// Phase 54 — the date is pinned to Asia/Bangkok (the server runs in UTC).
function today(localeBcp: string) {
  const weekday = new Intl.DateTimeFormat(localeBcp, { weekday: 'long', timeZone: 'Asia/Bangkok' }).format(new Date())
  const [y, m, d] = getTodayBangkok().split('-')
  return `${weekday} ${d}/${m}/${y}`
}

/**
 * The manager's first screen, in four tabs (`?view=`): what needs a decision
 * (settled right here, the default), today's figures, who arrives / leaves
 * today, and the last 7 days. Each tab loads only what it shows; the counts
 * on the tabs come from the cheap stats + movements queries.
 */
export default async function ManagerDashboard(props: PageProps<'/manager'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const todayIso = getTodayBangkok()
  const weekFrom = addDaysIso(todayIso, -6)
  const { view: viewParam } = await props.searchParams
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : 'actions'

  // Only the action lists wait for the alert counts; the rest loads alongside.
  const statsAndQueue = getManagerDashboardStats().then(async (s) => ({
    stats: s,
    queue: view === 'actions' ? await getManagerActionQueue(actionKinds(s.alerts)) : null,
  }))
  const [session, { stats, queue }, report, movements] = await Promise.all([
    getSession(),
    statsAndQueue,
    view === 'week' ? getReportsData(parseReportRange(weekFrom, todayIso)) : null,
    getTodayMovements(),
  ])
  const name = session?.fullName?.trim()
  const waiting = stats.alerts.reduce((n, a) => n + a.count, 0)

  const tabs = [
    { key: 'actions' as const, label: t('manager.actions.title'), icon: 'task_alt', badge: waiting, badgeTone: 'error' as const },
    { key: 'today' as const, label: t('manager.today.title'), icon: 'today' },
    {
      key: 'movements' as const,
      label: t('manager.movements.title'),
      icon: 'swap_horiz',
      badge: movements.arrivals.length + movements.departures.length,
    },
    { key: 'week' as const, label: t('manager.week.title'), icon: 'bar_chart' },
  ].map((tab) => ({ ...tab, href: tab.key === 'actions' ? '/manager' : `/manager?view=${tab.key}` }))

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12">
      <header className="mb-6">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
          {name ? `${greeting(t)}, ${name}` : greeting(t)}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">{today(localeBcp)}</p>
      </header>

      <Tabs active={view} tabs={tabs} />

      {view === 'actions' && queue && <ActionQueue alerts={stats.alerts} queue={queue} locale={locale} />}
      {view === 'today' && <TodayFigures stats={stats} locale={locale} />}
      {view === 'movements' && <TodayMovements data={movements} locale={locale} />}
      {view === 'week' && report && (
        <WeekTrend
          trend={report.trend}
          reportHref={`/manager/reports?from=${weekFrom}&to=${todayIso}`}
          locale={locale}
        />
      )}
    </div>
  )
}
