import { getMaintenanceReports } from '@/lib/data/housekeeper'
import { MaintenanceReportRow } from '@/components/housekeeping/MaintenanceReportRow'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { MaintenanceStatus } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type FilterStatus = 'all' | MaintenanceStatus

const STATUS_FILTERS: FilterStatus[] = ['all', 'open', 'in_progress', 'resolved']

const STATUS_FILTER_KEYS: Record<FilterStatus, string> = {
  all: 'reception.maintenancePage.filterAll',
  open: 'reception.maintenancePage.statusOpen',
  in_progress: 'reception.maintenancePage.statusInProgress',
  resolved: 'reception.maintenancePage.statusResolved',
}

const STATUS_FILTER_ICONS: Record<FilterStatus, string> = {
  all: 'list',
  open: 'report',
  in_progress: 'autorenew',
  resolved: 'task_alt',
}

export default async function ReceptionMaintenance(props: {
  searchParams: Promise<{ status?: string }>
}) {
  const locale = await getLocale()
  const t = getT(locale)
  const params = await props.searchParams
  const filter = (STATUS_FILTERS as string[]).includes((params.status as string) ?? 'all')
    ? ((params.status as FilterStatus) ?? 'all')
    : 'all'

  // Read-only view — reception sees the same report queue as manager.
  // Status changes happen via /manager/maintenance.
  // Load all once so every tab can show its count.
  const allReports = await getMaintenanceReports()
  const countOf = (f: FilterStatus) =>
    f === 'all' ? allReports.length : allReports.filter(r => r.status === f).length
  const reports = filter === 'all' ? allReports : allReports.filter(r => r.status === filter)

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-primary mb-2">
          {t('reception.maintenancePage.title')}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {t('reception.maintenancePage.subtitle')}
        </p>
      </header>

      {/* Same underlined tab style as /reception/rooms (RoomFilterTabs). */}
      <div
        role="tablist"
        aria-label={t('reception.maintenancePage.title')}
        className="flex items-center gap-1 border-b border-outline-variant overflow-x-auto mb-6"
      >
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/reception/maintenance' : `/reception/maintenance?status=${f}`}
            role="tab"
            aria-selected={filter === f}
            className={`inline-flex items-center gap-2 px-4 py-2 -mb-px text-label-md font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
              filter === f
                ? 'border-primary text-primary bg-surface-container'
                : 'border-transparent text-on-surface-variant hover:bg-surface-container hover:text-primary'
            }`}
          >
            <MaterialIcon name={STATUS_FILTER_ICONS[f]} size={16} />
            {t(STATUS_FILTER_KEYS[f])} ({countOf(f)})
          </a>
        ))}
      </div>

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">
          {t('reception.maintenancePage.noReports')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map(r => (
            <MaintenanceReportRow key={r.id} report={r} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}
