import { getMaintenanceReports, getAllRoomUnits } from '@/lib/data/housekeeper'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { SeverityBadge } from '@/components/housekeeping/SeverityBadge'
import { StatusBadge } from '@/components/housekeeping/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { formatBangkokDate, formatBangkokTime } from '@/lib/dates'
import type { MaintenanceReport, MaintenanceStatus } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const STATUSES: MaintenanceStatus[] = ['open', 'in_progress', 'resolved']

/**
 * Hotel-wide maintenance reports as a table (desktop) or a stacked list
 * (phone), newest first. Status tabs carry counts, so all reports load
 * once and are filtered here. Confirming/closing is the manager's job.
 */
export default async function MaintenanceReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const locale = await getLocale()
  const t = getT(locale)
  const bcp = (locale === 'en' ? 'en-GB' : 'th-TH') as 'th-TH' | 'en-GB'
  const params = await searchParams
  const filter: 'all' | MaintenanceStatus = STATUSES.includes(params.status as MaintenanceStatus)
    ? (params.status as MaintenanceStatus)
    : 'all'
  const [all, roomUnits] = await Promise.all([getMaintenanceReports(), getAllRoomUnits()])
  const reports = filter === 'all' ? all : all.filter((r) => r.status === filter)

  const tabs = [
    { key: 'all' as const, label: t('staff.filterAll'), href: '/housekeeper/maintenance', badge: all.length },
    ...STATUSES.map((s) => ({
      key: s,
      label: t(`staff.status.${s}`),
      href: `/housekeeper/maintenance?status=${s}`,
      badge: all.filter((r) => r.status === s).length,
    })),
  ]

  const room = (r: MaintenanceReport) => (r.room_unit ? t('staff.roomN', { room: r.room_unit.unit_label }) : '—')
  const reporter = (r: MaintenanceReport) => r.reporter?.full_name ?? t('staff.unknownPerson')
  const when = (r: MaintenanceReport) => (
    <>
      {formatBangkokDate(r.created_at, bcp)}
      <span className="text-on-surface-variant"> · {formatBangkokTime(r.created_at, bcp)}</span>
    </>
  )
  const issue = (r: MaintenanceReport) => (
    <>
      <p className="text-body-md font-semibold text-on-surface">{r.title}</p>
      <p className="text-[14px] text-on-surface-variant mt-0.5">{t(`staff.issueType.${r.issue_type}`)}</p>
      {r.description && <p className="text-[14px] text-on-surface mt-1 line-clamp-2">{r.description}</p>}
    </>
  )
  const th = 'py-3 px-4 text-[13px] font-medium text-on-surface-variant whitespace-nowrap'

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12 max-w-6xl">
      <header className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
            {t('housekeeper.maintenancePage.heading')}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">{t('housekeeper.maintenancePage.subtitle')}</p>
        </div>
        <MaintenanceReportModal roomUnits={roomUnits} />
      </header>

      <Tabs active={filter} tabs={tabs} />

      {reports.length === 0 ? (
        <p className="bg-surface-container-lowest rounded-2xl p-8 text-center text-body-md text-on-surface-variant">
          {t('staff.noMatchingReports')}
        </p>
      ) : (
        <>
          {/* Desktop / tablet: one row per report. */}
          <div className="hidden md:block bg-surface-container-lowest rounded-2xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-surface-container">
                <tr>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colRoom')}</th>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colIssue')}</th>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colSeverity')}</th>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colStatus')}</th>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colReporter')}</th>
                  <th scope="col" className={th}>{t('housekeeper.maintenancePage.colReportedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t border-surface-container first:border-t-0 align-top hover:bg-surface-container-low/60">
                    <td className="py-4 px-4 text-body-md font-semibold text-primary whitespace-nowrap">{room(r)}</td>
                    <td className="py-4 px-4 min-w-60">{issue(r)}</td>
                    <td className="py-4 px-4"><SeverityBadge severity={r.severity} /></td>
                    <td className="py-4 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-4 px-4 text-body-md text-on-surface whitespace-nowrap">{reporter(r)}</td>
                    <td className="py-4 px-4 text-body-md text-on-surface whitespace-nowrap tabular-nums">{when(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: the same fields stacked, room and badges first. */}
          <ul className="md:hidden bg-surface-container-lowest rounded-2xl px-4">
            {reports.map((r) => (
              <li key={r.id} className="py-4 border-t border-surface-container first:border-t-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body-md font-semibold text-primary">{room(r)}</span>
                  <SeverityBadge severity={r.severity} />
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2">{issue(r)}</div>
                <p className="mt-2 text-[14px] text-on-surface-variant tabular-nums">
                  {reporter(r)} · {formatBangkokDate(r.created_at, bcp)} {formatBangkokTime(r.created_at, bcp)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-[14px] text-on-surface-variant">{t('housekeeper.maintenancePage.managerNote')}</p>
    </div>
  )
}
