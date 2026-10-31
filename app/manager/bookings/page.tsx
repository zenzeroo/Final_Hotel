import { redirect } from 'next/navigation'
import { BOOKINGS_OVERSIGHT_PAGE_SIZE, getBookingsOversight } from '@/lib/data/manager'
import { BookingsOversightTabs } from '@/components/manager/BookingsOversightTabs'
import { BookingsTable } from '@/components/manager/BookingsTable'
import { RefundCard } from '@/components/manager/RefundCard'
import { AuditLogTable } from '@/components/manager/AuditLogTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'main' | 'refunds' | 'audit'

export default async function ManagerBookingsPage(props: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const searchParams = await props.searchParams
  const tab: Tab = (['main', 'refunds', 'audit'] as Tab[]).includes(
    (searchParams.tab as Tab) ?? 'main',
  )
    ? ((searchParams.tab as Tab) ?? 'main')
    : 'main'
  const pageParam = Number(searchParams.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1

  const [data, locale] = await Promise.all([getBookingsOversight(page), getLocale()])
  const t = getT(locale)

  // Out-of-range page (e.g. ?page=99, or the last page emptied out) → last real page.
  const totalPages = Math.ceil(data.bookingsTotal / BOOKINGS_OVERSIGHT_PAGE_SIZE)
  if (tab === 'main' && data.bookingsTotal > 0 && page > totalPages) {
    redirect(totalPages > 1 ? `/manager/bookings?page=${totalPages}` : '/manager/bookings')
  }

  return (
    // Full width (no max-w-7xl) so the bookings table reaches the right edge.
    <div className="p-8 lg:p-12">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">{t('manager.bookingsPage.heading')}</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('manager.bookingsPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
            <MaterialIcon name="search" size={16} className="text-on-surface-variant" />
            <input
              type="search"
              placeholder={t('manager.bookingsPage.searchPlaceholder')}
              className="bg-transparent text-body-md outline-none w-48"
            />
          </div>
        </div>
      </header>

      <BookingsOversightTabs active={tab} refundCount={data.refundRequests.length} />

      {tab === 'main' ? (
        <BookingsTable
          bookings={data.bookings}
          page={page}
          pageSize={BOOKINGS_OVERSIGHT_PAGE_SIZE}
          total={data.bookingsTotal}
          locale={locale}
        />
      ) : null}

      {tab === 'refunds' ? (
        <section>
          {data.refundRequests.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
              <p className="text-body-md text-on-surface-variant italic">
                {t('manager.bookingsPage.noPendingRefunds')}
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

      {tab === 'audit' ? <AuditLogTable entries={data.auditLog} locale={locale} /> : null}
    </div>
  )
}
