/**
 * Phase 54 — editable 7-day shift schedule. Columns come from `week.dates`
 * (always 7), not from the shift rows, so an empty week still renders a
 * full grid to fill in. Each cell is a client `<ShiftCell>`.
 */
import type { StaffMember, ShiftWeek } from '@/lib/data/types'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ShiftCell } from './ShiftCell'
import { SHIFT_STYLE, WORKING_SHIFTS, shiftLabelWithHours } from './shiftMeta'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface ShiftScheduleProps {
  staff: StaffMember[]
  week: ShiftWeek
  today: string
  locale: Locale
}

function formatDayHeader(dateStr: string, locale: Locale): { weekday: string; day: string } {
  // Pin UTC: `dateStr` is a calendar date, so UTC midnight keeps the same
  // weekday/day regardless of the server timezone.
  const d = new Date(`${dateStr}T00:00:00Z`)
  const bcp = locale === 'en' ? 'en-GB' : 'th-TH'
  const [, m, dd] = dateStr.split('-')
  return {
    weekday: new Intl.DateTimeFormat(bcp, { weekday: 'short', timeZone: 'UTC' }).format(d),
    day: `${dd}/${m}`,
  }
}

export function ShiftSchedule({ staff, week, today, locale }: ShiftScheduleProps) {
  const t = getT(locale)
  const activeStaff = staff.filter((s) => s.is_active)

  if (activeStaff.length === 0) {
    return <EmptyState icon="event" title={t('manager.staffPage.noStaff')} description="" />
  }

  const slotsByKey = new Map(week.slots.map((s) => [`${s.staffId}__${s.date}`, s.position]))

  return (
    <>
    <ul className="flex flex-wrap items-center gap-2 mb-3">
      {WORKING_SHIFTS.map((p) => (
        <li
          key={p}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption ${SHIFT_STYLE[p].tone}`}
        >
          <MaterialIcon name={SHIFT_STYLE[p].icon} size={14} />
          {shiftLabelWithHours(t, p)}
        </li>
      ))}
    </ul>
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface-container-low px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium border-b border-r border-outline-variant">
              {t('manager.staffPage.shiftStaffCol')}
            </th>
            {week.dates.map((d) => {
              const head = formatDayHeader(d, locale)
              const isToday = d === today
              return (
                <th
                  key={d}
                  className={`px-3 py-3 text-center text-label-md uppercase tracking-wider font-medium border-b border-outline-variant ${
                    isToday ? 'bg-secondary-container/40 text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  <div>{head.weekday}</div>
                  <div className="text-caption normal-case text-primary font-semibold mt-1">{head.day}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {activeStaff.map((member) => (
            <tr key={member.id} className="border-b border-outline-variant last:border-b-0">
              <td className="sticky left-0 z-10 bg-surface-container-lowest px-4 py-3 text-body-md font-medium text-primary border-r border-outline-variant whitespace-nowrap">
                {member.full_name}
              </td>
              {week.dates.map((d) => (
                <td key={d} className="px-1 py-3 text-center whitespace-nowrap">
                  <ShiftCell
                    // Re-mount when the server value changes (e.g. after
                    // "copy previous week") so the controlled state resyncs.
                    key={`${member.id}__${d}__${slotsByKey.get(`${member.id}__${d}`) ?? ''}`}
                    staffId={member.id}
                    staffName={member.full_name}
                    date={d}
                    position={slotsByKey.get(`${member.id}__${d}`) ?? null}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {/* Daily coverage: a day with nobody on shift disables auto-allocation. */}
        <tfoot>
          <tr className="border-t-2 border-outline-variant">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-surface-container-low px-4 py-3 text-left text-label-md uppercase tracking-wider text-on-surface-variant font-medium border-r border-outline-variant whitespace-nowrap"
            >
              {t('manager.staffPage.coverageRow')}
            </th>
            {week.dates.map((d) => {
              const count = activeStaff.filter((m) => {
                const p = slotsByKey.get(`${m.id}__${d}`)
                return p !== undefined && p !== 'off'
              }).length
              return (
                <td
                  key={d}
                  className={`px-2 py-3 text-center text-caption font-semibold ${
                    count === 0
                      ? 'bg-error-container text-on-error-container'
                      : d === today
                        ? 'bg-secondary-container/40 text-secondary'
                        : 'text-on-surface-variant'
                  }`}
                  title={count === 0 ? t('manager.staffPage.coverageNone') : undefined}
                >
                  {count === 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <MaterialIcon name="warning" size={14} />
                      <span className="sr-only">{t('manager.staffPage.coverageNone')}</span>
                      0
                    </span>
                  ) : (
                    t('manager.staffPage.coverageCount', { count })
                  )}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  )
}
