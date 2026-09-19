import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { listCustomers, getCustomerBookingCount } from '@/lib/data/supabase-account'
import { CustomersAdminTable } from '@/components/admin/CustomersAdminTable'

export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = ['all', 'active', 'suspended'] as const
type StatusFilter = (typeof STATUS_OPTIONS)[number]

function normalizeStatus(raw: string | undefined): StatusFilter {
  return STATUS_OPTIONS.includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : 'all'
}

export default async function AdminCustomersPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const sp = await props.searchParams
  const q = (sp.q ?? '').trim()
  const status = normalizeStatus(sp.status)

  // Server-side filter (Phase 36 — URL query params pattern).
  const isSuspended =
    status === 'suspended' ? true : status === 'active' ? false : undefined

  const customers = await listCustomers({
    search: q.length >= 2 ? q : undefined,
    isSuspended,
    limit: 200,
  })

  // Parallel booking counts per customer (one query per row — fine
  // up to ~200 customers). Could be optimised to a single GROUP BY
  // query later if the list ever grows beyond that.
  const counts = await Promise.all(
    customers.map((c) => getCustomerBookingCount(c.id)),
  )
  const enriched = customers.map((c, i) => ({ ...c, total_bookings: counts[i] }))

  const total = enriched.length
  const active = enriched.filter((c) => !c.is_suspended).length
  const suspended = enriched.filter((c) => c.is_suspended).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            จัดการลูกค้า
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ดู / ระงับ / ปลดระงับลูกค้าทั้งหมด
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="group" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">{total} คน</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ลูกค้าทั้งหมด
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{total}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ใช้งาน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{active}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ถูกระงับ
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{suspended}</p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ลูกค้าทั้งหมด
        </h2>
        <CustomersAdminTable
          customers={enriched}
          currentQuery={q}
          currentStatus={status}
        />
      </section>
    </div>
  )
}
