import { format } from 'date-fns'
import type { BookingOversightRow } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

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
  paid: 'Paid',
  pending: 'Pending',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export function BookingsTable({ bookings, activeCount }: BookingsTableProps) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-headline-sm text-headline-sm text-primary">Active Bookings</h3>
        <span className="text-caption text-on-surface-variant">
          Showing {bookings.length} of {activeCount} active
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-md">
          <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr>
              <th className="py-3 pr-4">ID</th>
              <th className="py-3 pr-4">Guest</th>
              <th className="py-3 pr-4">Room / Type</th>
              <th className="py-3 pr-4">Dates</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-outline-variant last:border-b-0">
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
                  <span className="font-semibold">Room {b.roomNumber}</span>
                  <span className="block text-caption text-on-surface-variant">{b.roomType}</span>
                </td>
                <td className="py-3 pr-4 text-on-surface-variant">
                  {format(new Date(b.checkIn), 'd MMM')} – {format(new Date(b.checkOut), 'd MMM')}
                  <span className="block text-caption">{b.nights} nights</span>
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
                    className="inline-flex items-center gap-1 text-caption text-primary hover:text-secondary"
                    title="Special Edit"
                  >
                    <MaterialIcon name="edit" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
