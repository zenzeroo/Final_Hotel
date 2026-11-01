import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAllBookings } from '@/lib/data/staff'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
import { BookingFilters } from './BookingFilters'
import { BookingTableRow } from './BookingTableRow'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const STATUS_TABS = [
  { key: 'all', label: 'reception.bookingsPage.filterAll' },
  { key: 'confirmed', label: 'reception.bookingsPage.filterUnpaid' },
  { key: 'checked_in', label: 'reception.bookingsPage.filterCheckedIn' },
  { key: 'checked_out', label: 'reception.bookingsPage.filterCheckedOut' },
  { key: 'cancelled', label: 'reception.bookingsPage.filterCancelled' },
] as const

type StatusKey = (typeof STATUS_TABS)[number]['key']

export default async function ReceptionBookingsPage(props: PageProps<'/reception/bookings'>) {
  const t = getT(await getLocale())
  const searchParams = await props.searchParams

  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : 'all'
  const statusFilter: StatusKey = STATUS_TABS.some((s) => s.key === statusParam) ? (statusParam as StatusKey) : 'all'
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

  // Tabs keep the search; switching status starts again at page 1.
  const tabHref = (status: StatusKey) => {
    const qs = new URLSearchParams()
    if (status !== 'all') qs.set('status', status)
    if (search) qs.set('q', search)
    const suffix = qs.toString()
    return suffix ? `/reception/bookings?${suffix}` : '/reception/bookings'
  }

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12">
      <header className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
            {t('reception.bookingsPage.heading')}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {total > 0
              ? t('reception.bookingsPage.countPaged', { total, page, pages: totalPages })
              : t('reception.bookingsPage.countZero')}
          </p>
        </div>
        <Link
          href="/reception/bookings/new"
          className="inline-flex items-center gap-2 h-11 px-5 bg-primary text-on-primary rounded-xl font-semibold text-body-md hover:bg-primary-container transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <MaterialIcon name="add" size={20} />
          {t('reception.walkInBooking')}
        </Link>
      </header>

      <Tabs
        active={statusFilter}
        tabs={STATUS_TABS.map((s) => ({ key: s.key, label: t(s.label), href: tabHref(s.key) }))}
      />

      <div className="mb-4">
        <BookingFilters initialSearch={search} />
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl">
          <MaterialIcon name="search_off" size={40} className="text-on-surface-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.bookingsPage.empty')}</p>
        </div>
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-2xl overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead className="border-b border-surface-container">
                <tr>
                  <Th>{t('reception.bookingsPage.colCode')}</Th>
                  <Th>{t('reception.bookingsPage.colGuest')}</Th>
                  <Th>{t('reception.bookingsPage.colRoom')}</Th>
                  <Th>{t('reception.bookingsPage.colDates')}</Th>
                  <Th>{t('reception.bookingsPage.colStatus')}</Th>
                  <Th align="right">{t('reception.bookingsPage.colTotal')}</Th>
                  <Th align="right">
                    <span className="sr-only">{t('reception.bookingsPage.colActions')}</span>
                  </Th>
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
      scope="col"
      className={`px-4 py-3 text-[13px] font-medium text-on-surface-variant whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}
