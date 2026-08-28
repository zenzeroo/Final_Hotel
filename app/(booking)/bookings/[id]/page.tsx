import { notFound } from 'next/navigation'
import { getSession } from '@/lib/supabase/getSession'
import { getBookingById } from '@/lib/data/bookings'
import { TransactionalHeader } from '@/components/layout/TransactionalHeader'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { ConfirmationActions } from './ConfirmationActions'
import { WriteReviewPrompt } from './WriteReviewPrompt'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function StatusBadge({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const isPaid = paymentStatus === 'paid'
  const isCancelled = status === 'cancelled'
  const isCheckedOut = status === 'checked_out'

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/10 text-error text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="cancel" size={16} />
        ยกเลิกแล้ว
      </span>
    )
  }
  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="verified" size={16} />
        ชำระเงินแล้ว
      </span>
    )
  }
  if (isCheckedOut) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-label-md font-semibold uppercase tracking-wider">
        <MaterialIcon name="logout" size={16} />
        เช็คเอาท์แล้ว
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-label-md font-semibold uppercase tracking-wider">
      <MaterialIcon name="schedule" size={16} />
      รอชำระเงิน
    </span>
  )
}

export default async function BookingConfirmationPage(props: PageProps<'/bookings/[id]'>) {
  const { id } = await props.params
  const session = await getSession()
  if (!session) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-body-lg text-on-surface-variant">กรุณาเข้าสู่ระบบ</p>
        </main>
        <Footer />
      </>
    )
  }

  const booking = await getBookingById(id, session.id)
  if (!booking) notFound()

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <TransactionalHeader backHref="/bookings" />
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-display text-3xl text-primary">การจองของคุณ</h1>
            <StatusBadge status={booking.status} paymentStatus={booking.payment_status} />
          </div>
          <p className="text-body-md text-on-surface-variant mb-8">
            รหัสการจอง: <span className="font-mono font-semibold">#{booking.booking_code}</span>
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
            {/* LEFT */}
            <div className="flex flex-col gap-6">
              {/* Room summary */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant flex gap-4">
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-surface-container shrink-0">
                  {booking.room_type && (
                    <Image
                      src={r2Url(booking.room_type.hero_image_key)}
                      alt={booking.room_type.name}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-xl text-primary">
                    {booking.room_type?.name_th ?? 'ห้องพัก'}
                  </h2>
                  <p className="text-caption text-on-surface-variant uppercase tracking-wider mt-1">
                    {booking.nights} คืน · {booking.guests} ท่าน
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-body-md">
                    <div>
                      <p className="text-caption text-on-surface-variant uppercase tracking-wider">เช็คอิน</p>
                      <p className="font-medium text-on-surface">{formatDate(booking.check_in)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-on-surface-variant uppercase tracking-wider">เช็คเอาท์</p>
                      <p className="font-medium text-on-surface">{formatDate(booking.check_out)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Booker info */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
                <h2 className="font-display text-xl text-primary mb-4">ข้อมูลผู้จอง</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DataRow label="ชื่อ-นามสกุล" value={booking.booker_full_name} />
                  <DataRow label="อีเมล" value={booking.booker_email} />
                  <DataRow label="เบอร์โทรศัพท์" value={booking.booker_phone ?? '—'} />
                </dl>
                {booking.special_request && (
                  <div className="mt-4 pt-4 border-t border-outline-variant">
                    <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">คำขอพิเศษ</p>
                    <p className="text-body-md text-on-surface">{booking.special_request}</p>
                  </div>
                )}
              </section>

              {/* Cancellation policy */}
              <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
                <h2 className="font-display text-xl text-primary mb-4">นโยบายการยกเลิก</h2>
                <p className="text-body-md text-on-surface">
                  ยกเลิกฟรีภายใน 24 ชั่วโมงก่อนเช็คอิน หลังจากนั้นจะถูกเรียกเก็บค่าห้องพัก 1 คืน
                </p>
              </section>

              {/* Review prompt — only after checkout */}
              {booking.status === 'checked_out' && booking.room_type ? (
                <WriteReviewPrompt
                  bookingId={booking.id}
                  roomTypeId={booking.room_type.id}
                  roomTypeName={booking.room_type.name_th ?? booking.room_type.name}
                />
              ) : null}
            </div>

            {/* RIGHT: Price summary + actions */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant p-6">
                <h2 className="font-display text-xl text-primary mb-4">สรุปการชำระเงิน</h2>

                <div className="flex flex-col gap-2 text-body-md">
                  <PriceRow label="ค่าห้องพัก" value={formatTHB(booking.base_subtotal)} />
                  {Number(booking.discount_total) > 0 && (
                    <PriceRow
                      label="ส่วนลด"
                      value={`-${formatTHB(booking.discount_total)}`}
                      discount
                    />
                  )}
                  <PriceRow label="ภาษี" value={formatTHB(booking.tax_total)} />
                  <PriceRow label="ค่าบริการรีสอร์ท" value={formatTHB(booking.fee_total)} />
                </div>

                <div className="my-4 border-t border-outline-variant" />
                <PriceRow label="รวมทั้งสิ้น" value={formatTHB(booking.total)} emphasis />

                <ConfirmationActions
                  bookingId={booking.id}
                  status={booking.status}
                  paymentStatus={booking.payment_status}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-on-surface-variant uppercase tracking-wider">{label}</dt>
      <dd className="text-body-md text-on-surface font-medium mt-1">{value}</dd>
    </div>
  )
}

function PriceRow({
  label,
  value,
  emphasis,
  discount,
}: {
  label: string
  value: string
  emphasis?: boolean
  discount?: boolean
}) {
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
