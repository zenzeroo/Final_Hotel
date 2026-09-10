import type { BookingOversightRow } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatDate } from '@/lib/dates'

interface BookingsTableProps {
  bookings: BookingOversightRow[]
  activeCount: number
}

const STATUS_CLASS: Record<BookingOversightRow['status'], string> = {
  paid: 'bg-primary-container text-on-primary-container',
  pending: 'bg-secondary-container text-on-secondary-container',
  cancelled: 'bg-error-container text-on-error-container',
  refunded: 'bg-surface-variant text-on-surface-variant',
}

const STATUS_LABEL: Record<BookingOversightRow['status'], string> = {
  paid: 'ชำระแล้ว',
  pending: 'รอดำเนินการ',
  cancelled: 'ยกเลิกแล้ว',
  refunded: 'คืนเงินแล้ว',
}

export function BookingsTable({ bookings, activeCount }: BookingsTableProps) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary">การจองที่ใช้งานอยู่</h3>
        <span className="text-caption text-on-surface-variant">
          แสดง {bookings.length} จาก {activeCount} รายการที่ใช้งานอยู่
        </span>
      </div>
      {/* Empty branch — guard against silent empty tbody on no-bookings DB.
          Previously rendered <table> with header + empty <tbody>. */}
      {bookings.length === 0 ? (
        <EmptyState
          icon="event_busy"
          title="ยังไม่มีการจองที่ใช้งานอยู่"
          description="เมื่อมีแขกจองห้องพัก รายการจะปรากฏที่นี่"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-md">
            <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
              <tr>
                <th className="py-3 pr-4">รหัส</th>
                <th className="py-3 pr-4">แขก</th>
                <th className="py-3 pr-4">ห้อง / ประเภท</th>
                <th className="py-3 pr-4">วันที่</th>
                <th className="py-3 pr-4">สถานะ</th>
                <th className="py-3 pr-4">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-outline-variant last:border-b-0 hover:bg-primary-fixed transition-colors">
                  <td className="py-3 pr-4 font-semibold text-primary">{b.code}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-caption font-semibold ${b.avatarBgClass}`}
                      >
                        {b.guestInitials}
                      </span>
                      <span className="text-on-surface">{b.guestName}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-on-surface">
                    <span className="font-semibold">ห้อง {b.roomNumber}</span>
                    <span className="block text-caption text-on-surface-variant">{b.roomType}</span>
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {formatDate(b.checkIn)} – {formatDate(b.checkOut)}
                    <span className="block text-caption">{b.nights} คืน</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-caption ${STATUS_CLASS[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-caption text-primary hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary rounded-md"
                      title="แก้ไขพิเศษ"
                    >
                      <MaterialIcon name="edit" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
