import { redirect } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Pagination } from '@/components/ui/Pagination'
import { listCustomers, getCustomerCounts } from '@/lib/data/supabase-account'
import { CustomersAdminTable } from '@/components/admin/CustomersAdminTable'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = ['all', 'active', 'suspended'] as const
type StatusFilter = (typeof STATUS_OPTIONS)[number]

function normalizeStatus(raw: string | undefined): StatusFilter {
  return STATUS_OPTIONS.includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : 'all'
}

const PAGE_SIZE = 20

export default async function AdminCustomersPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const t = getT(await getLocale())
  const sp = await props.searchParams
  const q = (sp.q ?? '').trim()
  const status = normalizeStatus(sp.status)
  const pageParam = Number(sp.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1

  // Server-side filter (Phase 36 — URL query params pattern).
  const isSuspended =
    status === 'suspended' ? true : status === 'active' ? false : undefined

  // One page of customers (booking counts come in the same query) + the
  // KPI totals over every customer.
  const [{ rows: customers, total: matching }, counts] = await Promise.all([
    listCustomers({ search: q.length >= 2 ? q : undefined, isSuspended, page, pageSize: PAGE_SIZE }),
    getCustomerCounts(),
  ])

  const totalPages = Math.ceil(matching / PAGE_SIZE)
  const keep = { q: q || undefined, status: status === 'all' ? undefined : status }
  if (matching > 0 && page > totalPages) {
    const qs = new URLSearchParams(Object.entries(keep).filter((e): e is [string, string] => !!e[1]))
    if (totalPages > 1) qs.set('page', String(totalPages))
    const suffix = qs.toString()
    redirect(suffix ? `/admin/customers?${suffix}` : '/admin/customers')
  }
  const { all: total, active, suspended } = counts

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('admin.customersPage.title')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.customersPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="group" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">{t('admin.customersPage.peopleCount', { count: total })}</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.customersPage.kpiAll')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{total}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.customersPage.statusActive')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{active}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.customersPage.statusSuspended')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{suspended}</p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary">
            {t('admin.customersPage.listHeading')}
          </h2>
          {customers.length > 0 && (
            <span className="text-caption text-on-surface-variant">
              {t('manager.bookingsTable.showing', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: (page - 1) * PAGE_SIZE + customers.length,
                total: matching,
              })}
            </span>
          )}
        </div>
        <CustomersAdminTable
          customers={customers}
          currentQuery={q}
          currentStatus={status}
        />
        <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/customers" extraParams={keep} />
      </section>
    </div>
  )
}
