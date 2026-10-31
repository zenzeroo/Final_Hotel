import { redirect } from 'next/navigation'
import { BOOKINGS_OVERSIGHT_PAGE_SIZE, getBookingsOversight } from '@/lib/data/manager'
import { BookingsOversightTabs } from '@/components/manager/BookingsOversightTabs'
import { BookingsTable } from '@/components/manager/BookingsTable'
import { RefundCard } from '@/components/manager/RefundCard'
import { AuditLogTable } from '@/components/manager/AuditLogTable'
import { SearchBox } from '@/components/ui/SearchBox'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'main' | 'refunds' | 'audit'

export default async function ManagerBookingsPage(props: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>
}) {
  const searchParams = await props.searchParams
  const tab: Tab = (['main', 'refunds', 'audit'] as Tab[]).includes(
    (searchParams.tab as Tab) ?? 'main',
  )
    ? ((searchParams.tab as Tab) ?? 'main')
    : 'main'
  const pageParam = Number(searchParams.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1
  const query = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : ''

  const [data, locale] = await Promise.all([getBookingsOversight(page, query), getLocale()])
  const t = getT(locale)

  // Out-of-range page (e.g. ?page=99, or the last page emptied out) → last real page.
  const totalPages = Math.ceil(data.bookingsTotal / BOOKINGS_OVERSIGHT_PAGE_SIZE)
  if (tab === 'main' && data.bookingsTotal > 0 && page > totalPages) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (totalPages > 1) qs.set('page', String(totalPages))
    const suffix = qs.toString()
    redirect(suffix ? `/manager/bookings?${suffix}` : '/manager/bookings')
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
      </header>

      <BookingsOversightTabs active={tab} refundCount={data.refundRequests.length} />

      {tab === 'main' ? (
        <>
          <SearchBox
            basePath="/manager/bookings"
            initialQuery={query}
            placeholder={t('manager.bookingsPage.searchPlaceholder')}
            buttonLabel={t('manager.bookingsPage.search')}
            className="mb-6"
          />
          <BookingsTable
            bookings={data.bookings}
            page={page}
            pageSize={BOOKINGS_OVERSIGHT_PAGE_SIZE}
            total={data.bookingsTotal}
            query={query}
            emptyTitle={query ? t('manager.bookingsPage.noMatch', { q: query }) : undefined}
            locale={locale}
          />
        </>
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
