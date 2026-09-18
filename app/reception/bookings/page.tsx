import Link from 'next/link'
import { getAllBookings } from '@/lib/data/staff'
import { formatTHB } from '@/lib/pricing'
import { formatDate } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { BookingFilters } from './BookingFilters'
import { BookingRowActions } from './BookingRowActions'

export const dynamic = 'force-dynamic'

export default async function ReceptionBookingsPage(props: PageProps<'/reception/bookings'>) {
  const searchParams = await props.searchParams

  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : 'all'
  const search = typeof searchParams.q === 'string' ? searchParams.q : ''

  const filters: Parameters<typeof getAllBookings>[0] = {}
  if (statusFilter !== 'all') {
    filters.status = [statusFilter]
  }
  if (search) {
    filters.search = search
  }

  const bookings = await getAllBookings(filters)

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-primary">จัดการการจอง</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {bookings.length} รายการ
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
          <p className="text-body-md text-on-surface-variant">ไม่พบการจอง</p>
        </div>
      ) : (
        <div className="mt-6 bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-x-auto overflow-y-hidden">
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <Th>รหัส</Th>
                <Th>ลูกค้า</Th>
                <Th>ห้อง</Th>
                <Th>เช็คอิน / เอาท์</Th>
                <Th>สถานะ</Th>
                <Th align="right">ยอดรวม</Th>
                <Th align="right">ดำเนินการ</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-outline-variant hover:bg-primary-fixed transition-colors">
                  <Td>
                    <span className="font-mono text-body-md">{b.booking_code}</span>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-body-md font-medium text-on-surface">{b.booker_full_name}</p>
                      <p className="text-caption text-on-surface-variant">{b.booker_email}</p>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-body-md text-on-surface">{b.room_type?.name_th}</p>
                    <p className="text-caption text-on-surface-variant">{b.guests} ท่าน · {b.nights} คืน</p>
                  </Td>
                  <Td>
                    <p className="text-body-md text-on-surface">{formatDate(b.check_in)}</p>
                    <p className="text-caption text-on-surface-variant">→ {formatDate(b.check_out)}</p>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${statusClass(b.status, b.payment_status)}`}>
                      {statusLabel(b.status, b.payment_status)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="text-body-md font-semibold text-primary">{formatTHB(b.total)}</span>
                  </Td>
                  <Td align="right">
                    <BookingRowActions bookingId={b.id} status={b.status} paymentStatus={b.payment_status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>
  )
}

function statusLabel(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'ยกเลิก'
  if (status === 'checked_in') return 'เข้าพัก'
  if (status === 'checked_out') return 'เช็คเอาท์'
  if (paymentStatus === 'paid') return 'ชำระแล้ว'
  if (status === 'confirmed') return 'รอชำระ'
  return 'รอ'
}

function statusClass(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_in') return 'bg-primary/10 text-primary'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}
