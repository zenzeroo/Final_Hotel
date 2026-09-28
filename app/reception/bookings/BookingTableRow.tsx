'use client'

import { useRouter } from 'next/navigation'
import { formatTHB } from '@/lib/pricing'
import { formatDate } from '@/lib/dates'
import { BookingRowActions } from './BookingRowActions'
import type { StaffBooking } from '@/lib/data/staff'

interface BookingTableRowProps {
  booking: StaffBooking
}

// Phase 46.1 — entire row clickable: clicking anywhere in cells 1-6
// (booking code, guest, room, dates, status, total) navigates to the
// detail page via onClick + router.push. The action column carries a
// stopPropagation handler so the eye icon, cancel X, and confirm modal
// backdrop clicks don't bubble up to trigger a redundant navigation.
//
// Tradeoff: right-click "Open in new tab" and keyboard Tab + Enter are
// not supported (no real <a> element). The eye icon button remains the
// keyboard-accessible entry point for the detail page.
export function BookingTableRow({ booking: b }: BookingTableRowProps) {
  const router = useRouter()
  const detailUrl = `/reception/bookings/${b.id}`

  return (
    <tr
      onClick={() => router.push(detailUrl)}
      className="border-t border-outline-variant hover:bg-primary-fixed transition-colors cursor-pointer"
    >
      <Td>
        <span className="font-mono text-body-md">{b.booking_code}</span>
      </Td>
      <Td>
        <p className="text-body-md font-medium text-on-surface">{b.booker_full_name}</p>
        <p className="text-caption text-on-surface-variant">{b.booker_email}</p>
      </Td>
      <Td>
        <p className="text-body-md text-on-surface">{b.room_type?.name_th}</p>
        <p className="text-caption text-on-surface-variant">
          {b.guests} ท่าน · {b.nights} คืน
        </p>
      </Td>
      <Td>
        <p className="text-body-md text-on-surface">{formatDate(b.check_in)}</p>
        <p className="text-caption text-on-surface-variant">→ {formatDate(b.check_out)}</p>
      </Td>
      <Td>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${statusClass(
            b.status,
            b.payment_status,
          )}`}
        >
          {statusLabel(b.status, b.payment_status)}
        </span>
      </Td>
      <Td align="right">
        <span className="text-body-md font-semibold text-primary">{formatTHB(b.total)}</span>
      </Td>
      {/* Action column — stopPropagation prevents row click when the user
          hits the eye icon, cancel X, the "รอชำระ" badge area, OR the
          confirm modal backdrop (which renders inside BookingRowActions). */}
      <Td align="right" onClick={(e) => e.stopPropagation()}>
        <BookingRowActions
          bookingId={b.id}
          status={b.status}
          paymentStatus={b.payment_status}
        />
      </Td>
    </tr>
  )
}

function Td({
  children,
  align,
  onClick,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td
      onClick={onClick}
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </td>
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
