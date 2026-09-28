import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBookingEvents } from '@/lib/data/staff'
import { listPaymentsByBooking } from '@/lib/data/supabase-payments'
import { getAllRoomUnits } from '@/lib/data/supabase-housekeeper'
import { formatTHB } from '@/lib/pricing'
import { formatDate, formatDateTime } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { BookingRowActions } from '../BookingRowActions'
import { CheckInOutActions } from '../../check-in-out/CheckInOutActions'
import type { Booking } from '@/lib/data/bookings'
import type { RoomTypeName } from '@/lib/data/types'
import type { Payment, PaymentStatus, PaymentMethod } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

interface RoomUnitBasic {
  id: string
  unit_label: string
  floor: number
  status: string
}

interface RefundRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  amount: number
  reason: string
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

interface GuestNote {
  id: string
  title: string
  body: string
  note_type: 'request' | 'complaint' | 'compliment' | 'general'
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
  staff: { full_name: string | null } | { full_name: string | null }[] | null
}

interface BookingEventRow {
  id: string
  event_type: string
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor: { full_name: string | null; role: string | null } | { full_name: string | null; role: string | null }[] | null
}

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
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

function paymentStatusLabel(s: PaymentStatus) {
  switch (s) {
    case 'pending': return 'รอดำเนินการ'
    case 'succeeded': return 'สำเร็จ'
    case 'failed': return 'ล้มเหลว'
    case 'expired': return 'หมดอายุ'
    case 'refunded': return 'คืนเงินแล้ว'
  }
}

function paymentMethodLabel(m: PaymentMethod) {
  switch (m) {
    case 'card': return 'บัตรเครดิต / PromptPay'
    case 'promptpay': return 'PromptPay'
    case 'cash': return 'เงินสด'
  }
}

function paymentStatusClass(s: PaymentStatus) {
  switch (s) {
    case 'succeeded': return 'bg-primary/10 text-primary'
    case 'pending': return 'bg-secondary/20 text-secondary'
    case 'refunded': return 'bg-surface-container text-on-surface-variant'
    case 'failed':
    case 'expired':
      return 'bg-error/10 text-error'
  }
}

function eventTypeLabel(t: string): string {
  switch (t) {
    case 'created': return 'สร้างการจอง'
    case 'confirmed': return 'ยืนยันการจอง'
    case 'checked_in': return 'เช็คอิน'
    case 'checked_out': return 'เช็คเอาท์'
    case 'cancelled': return 'ยกเลิก'
    case 'refund_approved': return 'อนุมัติคืนเงิน'
    case 'refund_rejected': return 'ปฏิเสธคืนเงิน'
    case 'refund_requested': return 'ขอคืนเงิน'
    case 'refund_confirmed': return 'คืนเงินสำเร็จ'
    case 'payment_confirmed': return 'ชำระเงินสำเร็จ'
    case 'note_added': return 'เพิ่มบันทึก'
    case 'temp_hold_acquired': return 'จองห้องชั่วคราว'
    case 'temp_hold_completed': return 'ยืนยันการจอง'
    case 'temp_hold_cancelled': return 'ยกเลิกการจองชั่วคราว'
    case 'temp_hold_expired': return 'การจองชั่วคราวหมดอายุ'
    default: return t
  }
}

function eventIcon(t: string): string {
  if (t.startsWith('temp_hold_')) return 'schedule'
  if (t === 'created') return 'add_circle'
  if (t === 'confirmed' || t === 'payment_confirmed') return 'verified'
  if (t === 'checked_in') return 'login'
  if (t === 'checked_out') return 'logout'
  if (t === 'cancelled') return 'cancel'
  if (t.startsWith('refund_')) return 'payments'
  if (t === 'note_added') return 'sticky_note_2'
  return 'event'
}

function noteTypeLabel(t: GuestNote['note_type']): string {
  switch (t) {
    case 'request': return 'คำขอ'
    case 'complaint': return 'ร้องเรียน'
    case 'compliment': return 'ชมเชย'
    case 'general': return 'ทั่วไป'
  }
}

function noteTypeClass(t: GuestNote['note_type']): string {
  switch (t) {
    case 'request': return 'bg-secondary/20 text-secondary'
    case 'complaint': return 'bg-error/10 text-error'
    case 'compliment': return 'bg-primary/10 text-primary'
    case 'general': return 'bg-surface-container text-on-surface-variant'
  }
}

export default async function ReceptionBookingDetailPage(props: PageProps<'/reception/bookings/[id]'>) {
  const { id } = await props.params
  const supabase = await createClient()

  // Parallel data fetch (6 queries, all under reception's RLS):
  // 1. booking + room_type join + raw room_unit_id + channel + promotion
  // 2. payments history (separate query — listPaymentsByBooking)
  // 3. refund_requests (latest pending or decided) for the refund badge
  // 4. booking_events timeline (via getBookingEvents helper, scoped)
  // 5. guest_notes (conditional — only fetched if any)
  // 6. room_units (for the check-in unit selector — reusable from housekeeper)
  const [
    bookingRes,
    payments,
    refundRes,
    bookingEvents,
    guestNotesRes,
    allRoomUnits,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, slug, name, name_th, type, hero_image_key),
        guest:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .eq('id', id)
      .maybeSingle(),
    listPaymentsByBooking(id),
    supabase
      .from('refund_requests')
      .select('id, status, amount, reason, decision_note, decided_at, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getBookingEvents(id),
    supabase
      .from('guest_notes')
      .select(`
        id, title, body, note_type, is_resolved, resolved_at, created_at,
        staff:profiles!guest_notes_staff_id_fkey(full_name)
      `)
      .eq('booking_id', id)
      .order('created_at', { ascending: false }),
    getAllRoomUnits(),
  ])

  if (bookingRes.error || !bookingRes.data) notFound()
  const booking = bookingRes.data as Booking & { room_unit_id: string | null; channel: string | null }

  // Assigned room unit (separate query — booking table has room_unit_id but
  // the Booking interface doesn't surface it. Fetch only if assigned.)
  let assignedUnit: RoomUnitBasic | null = null
  if (booking.room_unit_id) {
    const { data: u } = await supabase
      .from('room_units')
      .select('id, unit_label, floor, status')
      .eq('id', booking.room_unit_id)
      .maybeSingle()
    assignedUnit = u as RoomUnitBasic | null
  }

  const refund = (refundRes.data ?? null) as RefundRequest | null
  const guestNotes = (guestNotesRes.data ?? []) as GuestNote[]
  const events = (bookingEvents ?? []) as BookingEventRow[]
  const roomType = booking.room_type as (Booking['room_type'] & { type: RoomTypeName }) | undefined

  const isCancelled = booking.status === 'cancelled'
  const isCheckedOut = booking.status === 'checked_out'
  const isCheckedIn = booking.status === 'checked_in'
  const isConfirmed = booking.status === 'confirmed'
  const isPaid = booking.payment_status === 'paid'

  // Available units for check-in: same room_type, status='available'.
  // Housekeeper helper returns ALL active units with nested room_type
  // join (no flat room_type_id column), so we filter via u.room_type?.id.
  const availableUnits = allRoomUnits.filter(
    (u) =>
      roomType &&
      u.room_type?.id === roomType.id &&
      u.status === 'available'
  )

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-4">
        <Link
          href="/reception/bookings"
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon name="arrow_back" size={18} />
          กลับไปหน้ารายการจอง
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl text-primary">
          การจอง <span className="font-mono text-on-surface">#{booking.booking_code}</span>
        </h1>
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-caption font-semibold ${statusClass(booking.status, booking.payment_status)}`}
        >
          {statusLabel(booking.status, booking.payment_status)}
        </span>
        {refund && (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-caption font-semibold ${refund.status === 'approved' ? 'bg-primary/10 text-primary' : refund.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-secondary/20 text-secondary'}`}>
            คืนเงิน: {refund.status === 'pending' ? 'รออนุมัติ' : refund.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
          </span>
        )}
      </div>
      <p className="text-body-md text-on-surface-variant mb-8">
        สร้างเมื่อ {formatDateTime(booking.created_at)} · อัปเดตล่าสุด {formatDateTime(booking.updated_at)}
      </p>

      <div className="flex flex-col gap-6">
        {/* Section 1: Booking info */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ข้อมูลการจอง</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataRow label="เช็คอิน" value={formatDate(booking.check_in)} />
            <DataRow label="เช็คเอาท์" value={formatDate(booking.check_out)} />
            <DataRow label="จำนวนคืน" value={`${booking.nights} คืน`} />
            <DataRow label="ผู้เข้าพัก" value={`${booking.guests} ท่าน`} />
            <DataRow label="ประเภทห้อง" value={roomType?.name_th ?? booking.room_type?.name ?? '—'} />
            <DataRow label="ช่องทางการจอง" value={booking.channel ?? '—'} />
            {assignedUnit ? (
              <DataRow
                label="ห้องที่กำหนด"
                value={`${assignedUnit.unit_label} (ชั้น ${assignedUnit.floor}) · ${assignedUnit.status}`}
              />
            ) : (
              <DataRow label="ห้องที่กำหนด" value="ยังไม่กำหนด" muted />
            )}
          </div>
        </section>

        {/* Section 2: Guest info */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ข้อมูลลูกค้า</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataRow label="ชื่อ-นามสกุล" value={booking.booker_full_name} />
            <DataRow label="อีเมล" value={booking.booker_email} />
            <DataRow label="เบอร์โทรศัพท์" value={booking.booker_phone ?? '—'} />
          </div>
          {booking.special_request && (
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">คำขอพิเศษ</p>
              <p className="text-body-md text-on-surface whitespace-pre-wrap">{booking.special_request}</p>
            </div>
          )}
        </section>

        {/* Section 3: Payment */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">การชำระเงิน</h2>

          <div className="flex flex-col gap-2 text-body-md mb-4">
            <PriceRow label="ค่าห้องพัก (ก่อนส่วนลด)" value={formatTHB(booking.base_subtotal)} />
            {Number(booking.discount_total) > 0 && (
              <PriceRow label="ส่วนลด" value={`-${formatTHB(booking.discount_total)}`} discount />
            )}
            <PriceRow label="ภาษี" value={formatTHB(booking.tax_total)} />
            <PriceRow label="ค่าบริการรีสอร์ท" value={formatTHB(booking.fee_total)} />
            <div className="my-2 border-t border-outline-variant" />
            <PriceRow label="ยอดรวม" value={formatTHB(booking.total)} emphasis />
          </div>

          {refund && (
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <h3 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant mb-2">คำขอคืนเงิน</h3>
              <div className="flex flex-col gap-1 text-body-md">
                <p><span className="text-on-surface-variant">เหตุผล: </span>{refund.reason}</p>
                <p><span className="text-on-surface-variant">จำนวน: </span>{formatTHB(refund.amount)}</p>
                <p><span className="text-on-surface-variant">สถานะ: </span>{refund.status}</p>
                {refund.decision_note && (
                  <p><span className="text-on-surface-variant">หมายเหตุ: </span>{refund.decision_note}</p>
                )}
                {refund.decided_at && (
                  <p className="text-caption text-on-surface-variant">ตัดสินเมื่อ {formatDateTime(refund.decided_at)}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-outline-variant">
            <h3 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant mb-3">ประวัติการชำระเงิน</h3>
            {payments.length === 0 ? (
              <p className="text-body-md text-on-surface-variant italic">ยังไม่มีรายการชำระเงิน</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-md">
                  <thead className="text-caption uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                    <tr>
                      <th className="py-2 pr-3">วันที่</th>
                      <th className="py-2 pr-3">วิธีชำระ</th>
                      <th className="py-2 pr-3 text-right">จำนวน</th>
                      <th className="py-2 pr-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: Payment) => (
                      <tr key={p.id} className="border-b border-outline-variant last:border-b-0">
                        <td className="py-2 pr-3 text-on-surface-variant whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                        <td className="py-2 pr-3 text-on-surface">{paymentMethodLabel(p.payment_method)}</td>
                        <td className="py-2 pr-3 text-right font-medium text-on-surface">{formatTHB(p.amount)}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${paymentStatusClass(p.status)}`}>
                            {paymentStatusLabel(p.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Booking events timeline */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ประวัติการจอง</h2>
          {events.length === 0 ? (
            <p className="text-body-md text-on-surface-variant italic">ยังไม่มีรายการ</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {events.map((e) => {
                const actor = asObject(e.actor)
                return (
                  <li key={e.id} className="flex gap-3 items-start">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container shrink-0">
                      <MaterialIcon name={eventIcon(e.event_type)} size={16} className="text-primary" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md">
                        <span className="font-semibold text-on-surface">{eventTypeLabel(e.event_type)}</span>
                        {actor && (
                          <span className="text-caption text-on-surface-variant ml-2">
                            โดย {actor.full_name ?? 'ไม่ระบุ'}
                            {actor.role && <span className="ml-1">({actor.role})</span>}
                          </span>
                        )}
                      </p>
                      {e.description && (
                        <p className="text-caption text-on-surface-variant mt-0.5 break-words">{e.description}</p>
                      )}
                      <p className="text-caption text-on-surface-variant mt-0.5">{formatDateTime(e.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Section 5: Guest notes (conditional) */}
        {guestNotes.length > 0 && (
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
            <h2 className="font-display text-xl text-primary mb-4">บันทึกจากลูกค้า</h2>
            <ul className="flex flex-col gap-3">
              {guestNotes.map((n) => {
                const staff = asObject(n.staff)
                return (
                  <li key={n.id} className="p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${noteTypeClass(n.note_type)}`}>
                          {noteTypeLabel(n.note_type)}
                        </span>
                        <span className="font-semibold text-on-surface">{n.title}</span>
                      </div>
                      {n.is_resolved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                          <MaterialIcon name="verified" size={12} />
                          แก้ไขแล้ว
                        </span>
                      )}
                    </div>
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">{n.body}</p>
                    <p className="text-caption text-on-surface-variant mt-2">
                      โดย {staff?.full_name ?? 'ไม่ระบุ'} · {formatDateTime(n.created_at)}
                      {n.resolved_at && ` · แก้ไขเมื่อ ${formatDateTime(n.resolved_at)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Actions */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ดำเนินการ</h2>
          <div className="flex flex-wrap items-center gap-3">
            {isConfirmed && !isCancelled && (
              <CheckInOutActions
                bookingId={booking.id}
                action="check_in"
                label="เช็คอิน"
                availableUnits={availableUnits.map((u) => ({
                  id: u.id,
                  unit_label: u.unit_label,
                  floor: u.floor,
                }))}
              />
            )}
            {isCheckedIn && (
              <CheckInOutActions
                bookingId={booking.id}
                action="check_out"
                label="เช็คเอาท์"
                availableUnits={[]}
              />
            )}
            {isCheckedOut && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant text-body-md">
                <MaterialIcon name="logout" size={18} />
                เช็คเอาท์แล้ว
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error text-body-md">
                <MaterialIcon name="cancel" size={18} />
                ยกเลิกแล้ว
              </span>
            )}
            <div className="ml-auto">
              <BookingRowActions
                bookingId={booking.id}
                status={booking.status}
                paymentStatus={booking.payment_status}
              />
            </div>
          </div>
          {!isPaid && !isCancelled && (
            <p className="text-caption text-on-surface-variant mt-3">
              <MaterialIcon name="info" size={14} className="inline-block align-text-bottom mr-1" />
              ลูกค้ายังไม่ชำระเงิน — สามารถเช็คอินได้เมื่อชำระแล้ว
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function DataRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</dt>
      <dd className={`text-body-md mt-1 font-medium ${muted ? 'text-on-surface-variant font-normal italic' : 'text-on-surface'}`}>
        {value}
      </dd>
    </div>
  )
}

function PriceRow({ label, value, emphasis, discount }: { label: string; value: string; emphasis?: boolean; discount?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          emphasis
            ? 'text-body-md font-bold text-primary'
            : discount
            ? 'text-body-md text-error'
            : 'text-body-md text-on-surface-variant'
        }
      >
        {label}
      </span>
      <span
        className={
          emphasis
            ? 'text-lg font-display font-bold text-primary'
            : discount
            ? 'text-body-md font-medium text-error'
            : 'text-body-md text-on-surface'
        }
      >
        {value}
      </span>
    </div>
  )
}
