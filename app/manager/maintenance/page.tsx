import { getMaintenanceReports } from '@/lib/data/housekeeper'
import { MaintenanceReportCard } from '@/components/housekeeping/MaintenanceReportCard'
import { ConfirmMaintenanceButton } from '@/components/manager/ConfirmMaintenanceButton'
import { ResolveMaintenanceButton } from '@/components/manager/ResolveMaintenanceButton'
import type { MaintenanceStatus } from '@/lib/data/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type FilterStatus = 'all' | MaintenanceStatus

const STATUS_FILTERS: FilterStatus[] = ['all', 'open', 'in_progress', 'resolved']

const STATUS_FILTER_KEYS: Record<FilterStatus, string> = {
  all: 'manager.maintenancePage.filterAll',
  open: 'manager.maintenancePage.statusOpen',
  in_progress: 'manager.maintenancePage.statusInProgress',
  resolved: 'manager.maintenancePage.statusResolved',
}

export default async function ManagerMaintenance(props: {
  searchParams: Promise<{ status?: string }>
}) {
  const locale = await getLocale()
  const t = getT(locale)
  const params = await props.searchParams
  const filter = (STATUS_FILTERS as string[]).includes((params.status as string) ?? 'all')
    ? ((params.status as FilterStatus) ?? 'all')
    : 'all'

  const reports = await getMaintenanceReports(filter === 'all' ? undefined : { status: [filter] })
  const openCount = reports.filter(r => r.status === 'open').length
  const inProgressCount = reports.filter(r => r.status === 'in_progress').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          {t('manager.maintenancePage.title')}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {t('manager.maintenancePage.subtitle')}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">
            {t('manager.maintenancePage.openCount')}
          </p>
          <p className="font-display-lg text-display-lg text-error">{openCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">
            {t('manager.maintenancePage.inProgressCount')}
          </p>
          <p className="font-display-lg text-display-lg text-primary">{inProgressCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">
            {t('manager.maintenancePage.resolvedCount')}
          </p>
          <p className="font-display-lg text-display-lg text-on-surface-variant">{resolvedCount}</p>
        </div>
      </section>

      <nav className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/manager/maintenance' : `/manager/maintenance?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-caption uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
            }`}
          >
            {t(STATUS_FILTER_KEYS[f])}
          </a>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">
          {t('manager.maintenancePage.noReports')}
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30">
              <MaintenanceReportCard report={r} locale={locale} />
              {r.status === 'open' && (
                <div className="flex justify-end pt-3 mt-3 border-t border-outline-variant/30">
                  <ConfirmMaintenanceButton reportId={r.id} />
                </div>
              )}
              {r.status === 'in_progress' && (
                <div className="flex justify-end pt-3 mt-3 border-t border-outline-variant/30">
                  <ResolveMaintenanceButton reportId={r.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
