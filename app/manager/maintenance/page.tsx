import { redirect } from 'next/navigation'
import { getMaintenanceReports } from '@/lib/data/housekeeper'
import { MaintenanceReportTable } from '@/components/manager/MaintenanceReportTable'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
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

const PAGE_SIZE = 20

export default async function ManagerMaintenance(props: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const locale = await getLocale()
  const t = getT(locale)
  const params = await props.searchParams
  const filter = (STATUS_FILTERS as string[]).includes((params.status as string) ?? 'all')
    ? ((params.status as FilterStatus) ?? 'all')
    : 'all'
  const pageParam = Number(params.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1

  // Fetch every report once: the count cards always cover all statuses,
  // only the table follows the selected tab. The "all" tab lists outstanding
  // work only; resolved reports live under their own tab.
  const allReports = await getMaintenanceReports()
  const reports =
    filter === 'all'
      ? allReports.filter(r => r.status !== 'resolved')
      : allReports.filter(r => r.status === filter)
  // The full list is already loaded for the count cards, so pages are sliced here.
  const totalPages = Math.ceil(reports.length / PAGE_SIZE)
  const statusParam = filter === 'all' ? undefined : filter
  if (reports.length > 0 && page > totalPages) {
    const qs = new URLSearchParams()
    if (statusParam) qs.set('status', statusParam)
    if (totalPages > 1) qs.set('page', String(totalPages))
    const suffix = qs.toString()
    redirect(suffix ? `/manager/maintenance?${suffix}` : '/manager/maintenance')
  }
  const pageReports = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const openCount = allReports.filter(r => r.status === 'open').length
  const inProgressCount = allReports.filter(r => r.status === 'in_progress').length
  const resolvedCount = allReports.filter(r => r.status === 'resolved').length

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

      <Tabs
        active={filter}
        tabs={STATUS_FILTERS.map(f => ({
          key: f,
          label: t(STATUS_FILTER_KEYS[f]),
          href: f === 'all' ? '/manager/maintenance' : `/manager/maintenance?status=${f}`,
        }))}
      />

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">
          {t('manager.maintenancePage.noReports')}
        </p>
      ) : (
        <>
          <p className="mb-3 text-caption text-on-surface-variant">
            {t('manager.bookingsTable.showing', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: (page - 1) * PAGE_SIZE + pageReports.length,
              total: reports.length,
            })}
          </p>
          <MaintenanceReportTable reports={pageReports} locale={locale} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/manager/maintenance"
            extraParams={{ status: statusParam }}
          />
        </>
      )}
    </div>
  )
}
