import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAllBookings } from '@/lib/data/staff'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Pagination } from '@/components/ui/Pagination'
import { BookingFilters } from './BookingFilters'
import { BookingTableRow } from './BookingTableRow'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function ReceptionBookingsPage(props: PageProps<'/reception/bookings'>) {
  const t = getT(await getLocale())
  const searchParams = await props.searchParams

  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : 'all'
  const search = typeof searchParams.q === 'string' ? searchParams.q : ''

  const pageParam = Number(searchParams.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1

  const filters: Parameters<typeof getAllBookings>[0] = {
    page,
    pageSize: PAGE_SIZE,
  }
  if (statusFilter !== 'all') {
    filters.status = [statusFilter]
  }
  if (search) {
    filters.search = search
  }

  const result = await getAllBookings(filters)

  // Out-of-range page (e.g. user typed ?page=99 with only 3 pages of data)
  // → redirect to the last valid page while preserving other filters.
  if (result.total > 0 && page > result.totalPages) {
    const qs = new URLSearchParams()
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    if (search) qs.set('q', search)
    if (result.totalPages > 1) qs.set('page', String(result.totalPages))
    const suffix = qs.toString()
    redirect(suffix ? `/reception/bookings?${suffix}` : '/reception/bookings')
  }

  const { rows: bookings, total, totalPages } = result

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-primary">{t('reception.bookingsPage.heading')}</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {total > 0
              ? t('reception.bookingsPage.countPaged', { total, page, pages: totalPages })
              : t('reception.bookingsPage.countZero')}
          </p>
        </div>
        <Link
          href="/reception/bookings/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
        >
          <MaterialIcon name="add" size={18} />
          Walk-in Booking
        </Link>
      </div>

      <BookingFilters initialStatus={statusFilter} initialSearch={search} />

      {bookings.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="search_off" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.bookingsPage.empty')}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  <Th>{t('reception.bookingsPage.colCode')}</Th>
                  <Th>{t('reception.bookingsPage.colGuest')}</Th>
                  <Th>{t('reception.bookingsPage.colRoom')}</Th>
                  <Th>{t('reception.bookingsPage.colDates')}</Th>
                  <Th>{t('reception.bookingsPage.colStatus')}</Th>
                  <Th align="right">{t('reception.bookingsPage.colTotal')}</Th>
                  <Th align="right">{t('reception.bookingsPage.colActions')}</Th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <BookingTableRow key={b.id} booking={b} />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/reception/bookings"
            extraParams={{
              status: statusFilter !== 'all' ? statusFilter : undefined,
              q: search || undefined,
            }}
          />
        </>
      )}
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-caption text-on-surface-variant uppercase tracking-wider font-semibold ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}