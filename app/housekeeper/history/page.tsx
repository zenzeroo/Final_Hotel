import Link from 'next/link'
import { getSession } from '@/lib/supabase/getSession'
import { getMyWorkHistoryForUser } from '@/lib/data/housekeeper'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { TASK_TYPE_KEY } from '@/components/housekeeping/labels'
import { localizedName } from '@/lib/format/roomType'
import type { HousekeepingTask } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { addDaysIso, bangkokMonthRange, formatBangkokTime, getTodayBangkok, toBangkokIsoDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/** `YYYY-MM` shifted by `delta` months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const i = y * 12 + (m - 1) + delta
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/**
 * Work history: the month's finished tasks grouped by day, newest first,
 * so a housekeeper can find "what did I do on Tuesday" at a glance.
 * Month state lives in `?month=YYYY-MM` (default: current Bangkok month);
 * arrows step one month. "Today" and "last 7 days" ignore the month.
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

  // Malformed or out-of-range months (e.g. `2026-13`) fall back to the
  // current Bangkok month. Bounds are Bangkok-anchored so tasks finished
  // 00:00-06:59 on the 1st land in the right month.
  const today = getTodayBangkok()
  const currentMonth = today.slice(0, 7)
  const monthRaw = typeof params.month === 'string' ? params.month : ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw) ? monthRaw : currentMonth
  const { from: monthFrom, toExclusive: monthToExclusive } = bangkokMonthRange(month)

  const data = await getMyWorkHistoryForUser(session!.id, { monthFrom, monthToExclusive })

  const monthLabel = new Intl.DateTimeFormat(localeBcp, {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  }).format(new Date(monthFrom))
  const dayFormat = new Intl.DateTimeFormat(localeBcp, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  })
  const shortDate = new Intl.DateTimeFormat(localeBcp, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  })
  const yesterday = addDaysIso(today, -1)
  const isCurrentMonth = month === currentMonth
  const href = (m: string) => (m === currentMonth ? '/housekeeper/history' : `/housekeeper/history?month=${m}`)

  // Group by Bangkok calendar day; the query already sorts newest first.
  const days: { date: string; tasks: HousekeepingTask[] }[] = []
  for (const task of data.recentLog) {
    const date = task.completed_at ? toBangkokIsoDate(task.completed_at) : ''
    const last = days[days.length - 1]
    if (last && last.date === date) last.tasks.push(task)
    else days.push({ date, tasks: [task] })
  }
  const dayTitle = (date: string) =>
    date === today
      ? t('housekeeper.historyPage.tasksToday')
      : date === yesterday
        ? t('housekeeper.historyPage.yesterday')
        : dayFormat.format(new Date(`${date}T12:00:00+07:00`))

  const taskLine = (task: HousekeepingTask) => {
    const unit = task.room_unit
    return [
      TASK_TYPE_KEY[task.task_type] ? t(TASK_TYPE_KEY[task.task_type]) : task.task_type,
      unit?.room_type ? localizedName(unit.room_type, locale) : null,
      unit?.floor != null ? `${t('roomDetail.floor')} ${unit.floor}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const duration = (task: HousekeepingTask) => {
    if (!task.started_at || !task.completed_at) return null
    const mins = Math.max(1, Math.round((Date.parse(task.completed_at) - Date.parse(task.started_at)) / 60000))
    return mins < 60
      ? t('housekeeper.historyPage.minutes', { n: mins })
      : t('housekeeper.historyPage.hoursMinutes', { h: Math.floor(mins / 60), m: mins % 60 })
  }
  // "08:10–08:45"; a task started on an earlier day carries that date.
  const timeRange = (task: HousekeepingTask) => {
    const end = task.completed_at ? formatBangkokTime(task.completed_at, localeBcp) : '—'
    if (!task.started_at) return end
    const startDay = toBangkokIsoDate(task.started_at)
    const sameDay = task.completed_at && startDay === toBangkokIsoDate(task.completed_at)
    const start = formatBangkokTime(task.started_at, localeBcp)
    return sameDay ? `${start}–${end}` : `${shortDate.format(new Date(task.started_at))} ${start} – ${end}`
  }

  const figures = [
    { label: t('housekeeper.historyPage.roomsCleaned'), value: data.roomsCleaned },
    { label: t('housekeeper.historyPage.tasksToday'), value: data.tasksToday },
    { label: t('housekeeper.historyPage.tasksThisWeek'), value: data.tasksThisWeek },
  ]
  const arrow =
    'inline-flex items-center justify-center w-11 h-11 rounded-full text-primary hover:bg-surface-container-low transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12 max-w-4xl">
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
          {t('housekeeper.historyPage.pageTitle')}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">{t('housekeeper.historyPage.pageSubtitle')}</p>
      </header>

      {/* Month switcher + the month's figures in one panel. */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 md:p-6 mb-6">
        <nav aria-label={t('housekeeper.historyPage.monthNav')} className="flex items-center justify-between gap-2">
          <Link href={href(shiftMonth(month, -1))} className={arrow} aria-label={t('housekeeper.historyPage.prevMonth')}>
            <MaterialIcon name="chevron_left" size={24} />
          </Link>
          <div className="text-center">
            <h2 className="font-display text-xl md:text-2xl text-primary">{monthLabel}</h2>
            {!isCurrentMonth && (
              <Link
                href="/housekeeper/history"
                className="text-[14px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                {t('housekeeper.historyPage.thisMonth')}
              </Link>
            )}
          </div>
          {isCurrentMonth ? (
            <span className={`${arrow} opacity-30 pointer-events-none`} aria-hidden="true">
              <MaterialIcon name="chevron_right" size={24} />
            </span>
          ) : (
            <Link href={href(shiftMonth(month, 1))} className={arrow} aria-label={t('housekeeper.historyPage.nextMonth')}>
              <MaterialIcon name="chevron_right" size={24} />
            </Link>
          )}
        </nav>
        <dl className="mt-5 grid grid-cols-3 border-t border-surface-container pt-5">
          {figures.map((f) => (
            <div key={f.label} className="text-center px-2 border-l border-surface-container first:border-l-0">
              <dd className="font-display text-[28px] md:text-[32px] leading-none text-primary tabular-nums">{f.value}</dd>
              <dt className="mt-2 text-[14px] text-on-surface-variant">{f.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {days.length === 0 ? (
        <p className="bg-surface-container-lowest rounded-2xl p-8 text-center text-body-md text-on-surface-variant">
          {t('housekeeper.historyPage.emptyMonth')}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.date} aria-labelledby={`day-${day.date}`}>
              <div className="flex items-baseline justify-between gap-4 mb-2 px-1">
                <h3 id={`day-${day.date}`} className="text-body-lg font-semibold text-primary">
                  {dayTitle(day.date)}
                </h3>
                <span className="text-[14px] text-on-surface-variant tabular-nums">
                  {t('housekeeper.historyPage.dayCount', { count: day.tasks.length })}
                </span>
              </div>
              <ul className="bg-surface-container-lowest rounded-2xl px-5 md:px-6">
                {day.tasks.map((task) => {
                  const took = duration(task)
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-4 py-4 border-t border-surface-container first:border-t-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-lg font-semibold text-on-surface">
                          {t('staff.roomN', { room: task.room_unit?.unit_label ?? task.room_unit_id })}
                        </p>
                        <p className="text-[14px] text-on-surface-variant mt-0.5">{taskLine(task)}</p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className="text-body-md text-on-surface">{timeRange(task)}</p>
                        {took && <p className="text-[14px] text-on-surface-variant mt-0.5">{took}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {data.roomsCleaned > data.recentLog.length && (
            <p className="text-center text-[14px] text-on-surface-variant">
              {t('housekeeper.historyPage.shownOf', { shown: data.recentLog.length, total: data.roomsCleaned })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
