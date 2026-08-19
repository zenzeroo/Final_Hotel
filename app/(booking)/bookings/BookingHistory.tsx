'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cancelBooking } from '@/app/actions/booking'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import type { Booking } from '@/lib/data/bookings'

interface BookingHistoryProps {
  bookings: Booking[]
}

type Tab = 'active' | 'cancelled'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function statusLabel(status: Booking['status'], paymentStatus: Booking['payment_status']) {
  if (status === 'cancelled') return 'ยกเลิกแล้ว'
  if (status === 'checked_out') return 'เช็คเอาท์แล้ว'
  if (paymentStatus === 'paid') return 'ยืนยันแล้ว'
  return 'รอชำระเงิน'
}

function statusClass(status: Booking['status'], paymentStatus: Booking['payment_status']) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
}

export function BookingHistory({ bookings }: BookingHistoryProps) {
  const [tab, setTab] = useState<Tab>('active')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const activeBookings = bookings.filter((b) => b.status !== 'cancelled')
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled')

  const visible = tab === 'active' ? activeBookings : cancelledBookings

  const handleCancel = (bookingId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?')) return
    startTransition(async () => {
      const result = await cancelBooking(bookingId)
      if (result?.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant mb-6">
        <TabButton
          label="การจองทั้งหมด"
          count={activeBookings.length}
          active={tab === 'active'}
          onClick={() => setTab('active')}
        />
        <TabButton
          label="ยกเลิกแล้ว"
          count={cancelledBookings.length}
          active={tab === 'cancelled'}
          onClick={() => setTab('cancelled')}
        />
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-body-md text-on-surface-variant text-center py-12">
          {tab === 'active' ? 'ไม่มีการจองที่กำลังใช้งาน' : 'ไม่มีการจองที่ยกเลิก'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((b) => (
            <BookingRow key={b.id} booking={b} onCancel={handleCancel} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-secondary text-primary font-semibold'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
    >
      <span className="text-label-md uppercase tracking-wider">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-caption ${active ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
        {count}
      </span>
    </button>
  )
}

function BookingRow({
  booking,
  onCancel,
  isPending,
}: {
  booking: Booking
  onCancel: (id: string) => void
  isPending: boolean
}) {
  const isCancelled = booking.status === 'cancelled'
  const isCheckedOut = booking.status === 'checked_out'
  const isPaid = booking.payment_status === 'paid'

  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-hidden">
      <Link
        href={`/bookings/${booking.id}`}
        className="flex flex-col md:flex-row gap-4 p-4 md:p-6 hover:bg-surface-container-low transition-colors"
      >
        {/* Thumbnail */}
        <div className="relative w-full md:w-40 h-40 md:h-28 rounded-xl overflow-hidden bg-surface-container shrink-0">
          {booking.room_type && (
            <Image
              src={r2Url(booking.room_type.hero_image_key)}
              alt={booking.room_type.name}
              fill
              sizes="(max-width: 768px) 100vw, 160px"
              className="object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-display text-lg text-primary truncate">
              {booking.room_type?.name_th ?? 'ห้องพัก'}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${statusClass(booking.status, booking.payment_status)}`}
            >
              {statusLabel(booking.status, booking.payment_status)}
            </span>
          </div>
          <p className="text-caption text-on-surface-variant font-mono mb-2">
            #{booking.booking_code}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="event" size={16} />
              {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="group" size={16} />
              {booking.guests} ท่าน
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="md:text-right shrink-0">
          <p className="text-caption text-on-surface-variant uppercase tracking-wider">รวม</p>
          <p className="text-xl font-display font-bold text-primary">{formatTHB(booking.total)}</p>
        </div>
      </Link>

      {/* Actions */}
      {!isCancelled && !isCheckedOut && (
        <div className="flex items-center gap-2 px-4 md:px-6 pb-4">
          {!isPaid && (
            <Link
              href={`/bookings/${booking.id}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
            >
              <MaterialIcon name="credit_card" size={16} />
              ชำระเงิน
            </Link>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onCancel(booking.id)
            }}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-error text-error rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-error hover:text-on-primary transition-colors disabled:opacity-60"
          >
            <MaterialIcon name="cancel" size={16} />
            ขอยกเลิก
          </button>
        </div>
      )}
    </article>
  )
}
