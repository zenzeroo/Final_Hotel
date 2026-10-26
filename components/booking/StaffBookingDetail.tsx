/**
 * Phase 54 — staff booking detail, shared by `/reception/bookings/[id]`
 * (with check-in/out + cancel actions) and `/manager/bookings/[id]`
 * (read-only). Extracted verbatim from the Phase 46 reception page and
 * localized (TH/EN) via the `bookingDetailStaff.*` dictionary namespace.
 *
 * Server component: all queries run under the caller's RLS (`is_staff()`
 * covers reception, manager and admin) — no service-role client.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBookingEvents } from '@/lib/data/staff'
import { listPaymentsByBooking } from '@/lib/data/supabase-payments'
import { getAllRoomUnits } from '@/lib/data/supabase-housekeeper'
import { splitCheckInUnits } from '@/lib/room-status'
import { formatTHB } from '@/lib/pricing'
import { formatDate, formatDateTime } from '@/lib/dates'
import { getT } from '@/lib/i18n/t'
import type { Locale } from '@/lib/i18n/config'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { BookingRowActions } from '@/app/reception/bookings/BookingRowActions'
import { CheckInOutActions } from '@/app/reception/check-in-out/CheckInOutActions'
import type { Booking } from '@/lib/data/bookings'
import type { RoomTypeName } from '@/lib/data/types'
import type { Payment, PaymentStatus } from '@/lib/payments/types'

type T = ReturnType<typeof getT>

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

const KNOWN_EVENTS = new Set([
  'created', 'confirmed', 'checked_in', 'checked_out', 'cancelled',
  'refund_approved', 'refund_rejected', 'refund_requested', 'refund_confirmed',
  'payment_confirmed', 'note_added',
  'temp_hold_acquired', 'temp_hold_completed', 'temp_hold_cancelled', 'temp_hold_expired',
])

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function statusLabel(t: T, status: string, paymentStatus: string) {
  if (status === 'cancelled') return t('bookingDetailStaff.status.cancelled')
  if (status === 'checked_in') return t('bookingDetailStaff.status.checkedIn')
  if (status === 'checked_out') return t('bookingDetailStaff.status.checkedOut')
  if (paymentStatus === 'paid') return t('bookingDetailStaff.status.paid')
  if (status === 'confirmed') return t('bookingDetailStaff.status.awaitingPayment')
  return t('bookingDetailStaff.status.pending')
}

function statusClass(status: string, paymentStatus: string) {
  if (status === 'cancelled') return 'bg-error/10 text-error'
  if (status === 'checked_in') return 'bg-primary/10 text-primary'
  if (status === 'checked_out') return 'bg-surface-container text-on-surface-variant'
  if (paymentStatus === 'paid') return 'bg-primary/10 text-primary'
  return 'bg-secondary/20 text-secondary'
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

function eventTypeLabel(t: T, type: string): string {
  return KNOWN_EVENTS.has(type) ? t(`bookingDetailStaff.event.${type}`) : type
}

function eventIcon(type: string): string {
  if (type.startsWith('temp_hold_')) return 'schedule'
  if (type === 'created') return 'add_circle'
  if (type === 'confirmed' || type === 'payment_confirmed') return 'verified'
  if (type === 'checked_in') return 'login'
  if (type === 'checked_out') return 'logout'
  if (type === 'cancelled') return 'cancel'
  if (type.startsWith('refund_')) return 'payments'
  if (type === 'note_added') return 'sticky_note_2'
  return 'event'
}

function noteTypeClass(type: GuestNote['note_type']): string {
  switch (type) {
    case 'request': return 'bg-secondary/20 text-secondary'
    case 'complaint': return 'bg-error/10 text-error'
    case 'compliment': return 'bg-primary/10 text-primary'
    case 'general': return 'bg-surface-container text-on-surface-variant'
  }
}

interface StaffBookingDetailProps {
  bookingId: string
  backHref: string
  backLabel: string
  /** Reception: check-in/out + cancel. Manager: read-only (false). */
  showActions: boolean
  locale: Locale
}

export async function StaffBookingDetail({
  bookingId: id,
  backHref,
  backLabel,
  showActions,
  locale,
}: StaffBookingDetailProps) {
  const t = getT(locale)
  const bcp = locale === 'en' ? 'en-GB' : 'th-TH'
  const fmtDate = (iso: string) => formatDate(iso, bcp)
  const fmtDateTime = (iso: string) => formatDateTime(iso, bcp)
  const supabase = await createClient()

  // Parallel data fetch (all under the caller's staff RLS):
  // 1. booking + room_type join + raw room_unit_id + channel + promotion
  // 2. payments history (separate query — listPaymentsByBooking)
  // 3. refund_requests (latest pending or decided) for the refund badge
  // 4. booking_events timeline (via getBookingEvents helper, scoped)
  // 5. guest_notes (conditional — only rendered if any)
  // 6. room_units (only for the check-in unit selector → actions only)
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
    showActions ? getAllRoomUnits() : Promise.resolve([]),
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
  const roomTypeName =
    locale === 'th'
      ? (roomType?.name_th ?? booking.room_type?.name ?? '—')
      : (booking.room_type?.name ?? '—')

  const isCancelled = booking.status === 'cancelled'
  const isCheckedOut = booking.status === 'checked_out'
  const isCheckedIn = booking.status === 'checked_in'
  const isConfirmed = booking.status === 'confirmed'
  const isPaid = booking.payment_status === 'paid'

  // Rooms for check-in (lib/room-status.ts): the booked room type's ready
  // room is the default; other ready rooms only when reception says the
  // booked one has a problem. Housekeeper helper returns ALL active units
  // with a nested room_type join (no flat room_type_id column).
  const { booked: bookedUnits, others: otherUnits, bookedNotReady } = splitCheckInUnits(
    allRoomUnits.map((u) => ({
      id: u.id,
      unit_label: u.unit_label,
      floor: u.floor,
      status: u.status,
      roomTypeId: u.room_type?.id ?? null,
      roomTypeName: u.room_type?.name_th ?? null,
    })),
    roomType?.id ?? null,
  )

  const sectionClass =
    'bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant'

  return (
    <div className={`p-6 md:p-8 ${showActions ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <div className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon name="arrow_back" size={18} />
          {backLabel}
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl text-primary">
          {t('bookingDetailStaff.title')}{' '}
          <span className="font-mono text-on-surface">#{booking.booking_code}</span>
        </h1>
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-caption font-semibold ${statusClass(booking.status, booking.payment_status)}`}
        >
          {statusLabel(t, booking.status, booking.payment_status)}
        </span>
        {refund && (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-caption font-semibold ${refund.status === 'approved' ? 'bg-primary/10 text-primary' : refund.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-secondary/20 text-secondary'}`}>
            {t('bookingDetailStaff.refundBadge', { status: t(`bookingDetailStaff.refundState.${refund.status}`) })}
          </span>
        )}
      </div>
      <p className="text-body-md text-on-surface-variant mb-8">
        {t('bookingDetailStaff.createdUpdated', {
          created: fmtDateTime(booking.created_at),
          updated: fmtDateTime(booking.updated_at),
        })}
      </p>

      <div
        className={
          showActions ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start' : undefined
        }
      >
      <div className="flex flex-col gap-6 min-w-0">
        {/* Section 1: Booking info */}
        <section className={sectionClass}>
          <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionBooking')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataRow label={t('bookingDetailStaff.checkIn')} value={fmtDate(booking.check_in)} />
            <DataRow label={t('bookingDetailStaff.checkOut')} value={fmtDate(booking.check_out)} />
            <DataRow label={t('bookingDetailStaff.nights')} value={t('bookingDetailStaff.nightsValue', { count: booking.nights })} />
            <DataRow label={t('bookingDetailStaff.guests')} value={t('bookingDetailStaff.guestsValue', { count: booking.guests })} />
            <DataRow label={t('bookingDetailStaff.roomType')} value={roomTypeName} />
            <DataRow label={t('bookingDetailStaff.channel')} value={booking.channel ?? '—'} />
            {assignedUnit ? (
              <DataRow
                label={t('bookingDetailStaff.assignedUnit')}
                value={t('bookingDetailStaff.assignedUnitValue', {
                  unit: assignedUnit.unit_label,
                  floor: assignedUnit.floor,
                  status: assignedUnit.status,
                })}
              />
            ) : (
              <DataRow label={t('bookingDetailStaff.assignedUnit')} value={t('bookingDetailStaff.notAssigned')} muted />
            )}
          </div>
        </section>

        {/* Section 2: Guest info */}
        <section className={sectionClass}>
          <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionGuest')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataRow label={t('bookingDetailStaff.fullName')} value={booking.booker_full_name} />
            <DataRow label={t('bookingDetailStaff.email')} value={booking.booker_email} />
            <DataRow label={t('bookingDetailStaff.phone')} value={booking.booker_phone ?? '—'} />
          </div>
          {booking.special_request && (
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">
                {t('bookingDetailStaff.specialRequest')}
              </p>
              <p className="text-body-md text-on-surface whitespace-pre-wrap">{booking.special_request}</p>
            </div>
          )}
        </section>

        {/* Section 3: Payment */}
        <section className={sectionClass}>
          <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionPayment')}</h2>

          <div className="flex flex-col gap-2 text-body-md mb-4">
            <PriceRow label={t('bookingDetailStaff.subtotal')} value={formatTHB(booking.base_subtotal)} />
            {Number(booking.discount_total) > 0 && (
              <PriceRow label={t('bookingDetailStaff.discount')} value={`-${formatTHB(booking.discount_total)}`} discount />
            )}
            <PriceRow label={t('bookingDetailStaff.tax')} value={formatTHB(booking.tax_total)} />
            <PriceRow label={t('bookingDetailStaff.resortFee')} value={formatTHB(booking.fee_total)} />
            <div className="my-2 border-t border-outline-variant" />
            <PriceRow label={t('bookingDetailStaff.total')} value={formatTHB(booking.total)} emphasis />
          </div>

          {refund && (
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <h3 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
                {t('bookingDetailStaff.refundRequest')}
              </h3>
              <div className="flex flex-col gap-1 text-body-md">
                <p><span className="text-on-surface-variant">{t('bookingDetailStaff.refundReason')}: </span>{refund.reason}</p>
                <p><span className="text-on-surface-variant">{t('bookingDetailStaff.refundAmount')}: </span>{formatTHB(refund.amount)}</p>
                <p>
                  <span className="text-on-surface-variant">{t('bookingDetailStaff.refundStatus')}: </span>
                  {t(`bookingDetailStaff.refundState.${refund.status}`)}
                </p>
                {refund.decision_note && (
                  <p><span className="text-on-surface-variant">{t('bookingDetailStaff.refundNote')}: </span>{refund.decision_note}</p>
                )}
                {refund.decided_at && (
                  <p className="text-caption text-on-surface-variant">
                    {t('bookingDetailStaff.decidedAt', { date: fmtDateTime(refund.decided_at) })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-outline-variant">
            <h3 className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant mb-3">
              {t('bookingDetailStaff.paymentHistory')}
            </h3>
            {payments.length === 0 ? (
              <p className="text-body-md text-on-surface-variant italic">{t('bookingDetailStaff.noPayments')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-md">
                  <thead className="text-caption uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
                    <tr>
                      <th className="py-2 pr-3">{t('bookingDetailStaff.colDate')}</th>
                      <th className="py-2 pr-3">{t('bookingDetailStaff.colMethod')}</th>
                      <th className="py-2 pr-3 text-right">{t('bookingDetailStaff.colAmount')}</th>
                      <th className="py-2 pr-3">{t('bookingDetailStaff.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: Payment) => (
                      <tr key={p.id} className="border-b border-outline-variant last:border-b-0">
                        <td className="py-2 pr-3 text-on-surface-variant whitespace-nowrap">{fmtDateTime(p.created_at)}</td>
                        <td className="py-2 pr-3 text-on-surface">
                          {t(`bookingDetailStaff.paymentMethod.${p.payment_method}`)}
                        </td>
                        <td className="py-2 pr-3 text-right font-medium text-on-surface">{formatTHB(p.amount)}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${paymentStatusClass(p.status)}`}>
                            {t(`bookingDetailStaff.paymentState.${p.status}`)}
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
        <section className={sectionClass}>
          <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionTimeline')}</h2>
          {events.length === 0 ? (
            <p className="text-body-md text-on-surface-variant italic">{t('bookingDetailStaff.noEvents')}</p>
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
                        <span className="font-semibold text-on-surface">{eventTypeLabel(t, e.event_type)}</span>
                        {actor && (
                          <span className="text-caption text-on-surface-variant ml-2">
                            {t('bookingDetailStaff.by', { name: actor.full_name ?? t('bookingDetailStaff.unknown') })}
                            {actor.role && <span className="ml-1">({actor.role})</span>}
                          </span>
                        )}
                      </p>
                      {e.description && (
                        <p className="text-caption text-on-surface-variant mt-0.5 break-words">{e.description}</p>
                      )}
                      <p className="text-caption text-on-surface-variant mt-0.5">{fmtDateTime(e.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Section 5: Guest notes (conditional) */}
        {guestNotes.length > 0 && (
          <section className={sectionClass}>
            <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionNotes')}</h2>
            <ul className="flex flex-col gap-3">
              {guestNotes.map((n) => {
                const staff = asObject(n.staff)
                return (
                  <li key={n.id} className="p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold ${noteTypeClass(n.note_type)}`}>
                          {t(`bookingDetailStaff.noteType.${n.note_type}`)}
                        </span>
                        <span className="font-semibold text-on-surface">{n.title}</span>
                      </div>
                      {n.is_resolved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                          <MaterialIcon name="verified" size={12} />
                          {t('bookingDetailStaff.resolved')}
                        </span>
                      )}
                    </div>
                    <p className="text-body-md text-on-surface whitespace-pre-wrap">{n.body}</p>
                    <p className="text-caption text-on-surface-variant mt-2">
                      {t('bookingDetailStaff.by', { name: staff?.full_name ?? t('bookingDetailStaff.unknown') })} ·{' '}
                      {fmtDateTime(n.created_at)}
                      {n.resolved_at && ` · ${t('bookingDetailStaff.resolvedAt', { date: fmtDateTime(n.resolved_at) })}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

      </div>
      {/* Actions (reception only) — right column, sticky on xl+ (below
          that the sidebar leaves too little width for two columns); first
          on narrower screens so the check-in button needs no scrolling. */}
      {showActions && (
        <aside className="order-first xl:order-none xl:sticky xl:top-6">
          <section className={sectionClass}>
            <h2 className="font-display text-xl text-primary mb-4">{t('bookingDetailStaff.sectionActions')}</h2>
            <div className="flex flex-wrap items-center gap-3">
              {isConfirmed && !isCancelled && (
                <CheckInOutActions
                  bookingId={booking.id}
                  action="check_in"
                  label={t('bookingDetailStaff.checkIn')}
                  bookedUnits={bookedUnits}
                  otherUnits={otherUnits}
                  bookedNotReady={bookedNotReady}
                />
              )}
              {isCheckedIn && (
                <CheckInOutActions
                  bookingId={booking.id}
                  action="check_out"
                  label={t('bookingDetailStaff.checkOut')}
                />
              )}
              {isCheckedOut && (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant text-body-md">
                  <MaterialIcon name="logout" size={18} />
                  {t('bookingDetailStaff.checkedOutBadge')}
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error text-body-md">
                  <MaterialIcon name="cancel" size={18} />
                  {t('bookingDetailStaff.cancelledBadge')}
                </span>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant">
              <BookingRowActions
                bookingId={booking.id}
                status={booking.status}
                paymentStatus={booking.payment_status}
              />
            </div>
            {!isPaid && !isCancelled && (
              <p className="text-caption text-on-surface-variant mt-3">
                <MaterialIcon name="info" size={14} className="inline-block align-text-bottom mr-1" />
                {t('bookingDetailStaff.unpaidHint')}
              </p>
            )}
          </section>
        </aside>
      )}
      </div>
    </div>
  )
}

function DataRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</dt>
      <dd className={`text-body-md mt-1 font-medium [overflow-wrap:anywhere] ${muted ?'text-on-surface-variant font-normal italic' : 'text-on-surface'}`}>
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
