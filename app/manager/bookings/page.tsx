import { getBookingsOversight } from '@/lib/data/manager'
import { BookingsOversightTabs } from '@/components/manager/BookingsOversightTabs'
import { BookingsTable } from '@/components/manager/BookingsTable'
import { RefundCard } from '@/components/manager/RefundCard'
import { AuditLogTable } from '@/components/manager/AuditLogTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

type Tab = 'main' | 'refunds' | 'audit'

export default async function ManagerBookingsPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const tab: Tab = (['main', 'refunds', 'audit'] as Tab[]).includes(
    (searchParams.tab as Tab) ?? 'main',
  )
    ? ((searchParams.tab as Tab) ?? 'main')
    : 'main'

  const data = await getBookingsOversight()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">ดูแลการจอง</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ตรวจสอบการจอง คำขอคืนเงิน และกิจกรรมของเจ้าหน้าที่
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
            <MaterialIcon name="search" size={16} className="text-on-surface-variant" />
            <input
              type="search"
              placeholder="ค้นหาการจอง..."
              className="bg-transparent text-body-md outline-none w-48"
            />
          </div>
        </div>
      </header>

      <BookingsOversightTabs active={tab} refundCount={data.refundRequests.length} />

      {tab === 'main' ? (
        <BookingsTable bookings={data.bookings} activeCount={data.activeCount} />
      ) : null}

      {tab === 'refunds' ? (
        <section>
          {data.refundRequests.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
              <p className="text-body-md text-on-surface-variant italic">
                ไม่มีคำขอคืนเงินที่รอดำเนินการ
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.refundRequests.map((r) => (
                <RefundCard key={r.id} refund={r} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'audit' ? <AuditLogTable entries={data.auditLog} /> : null}
    </div>
  )
}
