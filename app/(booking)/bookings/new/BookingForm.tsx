'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useTransition, useMemo } from 'react'
import { useFormStatus } from 'react-dom'
import { createBooking, type CreateBookingResult } from '@/app/actions/booking'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { calculatePrice, formatTHB, type PricingSettings } from '@/lib/pricing'
import { r2Url } from '@/lib/r2/publicUrl'
import type { QuoteResult } from '@/lib/pricing/seasons'

interface BookingFormProps {
  room: {
    id: string
    slug: string
    name: string
    name_th: string
    hero_image_key: string
    base_price: number
  }
  checkIn: string
  checkOut: string
  guests: number
  profile: {
    fullName: string
    email: string
    phone: string
  }
  /** Phase 8 — server-computed quote (already includes seasonal rate nightly breakdown). */
  quote: QuoteResult
  /** True when an applied seasonal rate has min_nights_override > stay length. */
  minNightsBlocked: boolean
  /**
   * Phase 12 — live tax + resort fee from `hotel_settings`, fetched by the
   * server page. Falls back to `DEFAULT_PRICING` (0.07 / 150) at the server
   * if the singleton row is missing; this preview matches the value the
   * server action will write into `bookings.tax_total` / `fee_total`.
   */
  settings: PricingSettings
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังดำเนินการ…
        </>
      ) : (
        <>
          <MaterialIcon name="lock" size={18} />
          ยืนยันการจ่ายเงิน
        </>
      )}
    </button>
  )
}

export function BookingForm({ room, checkIn, checkOut, guests, profile, quote, minNightsBlocked, settings }: BookingFormProps) {
  const router = useRouter()
  const [state, setState] = useState<CreateBookingResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState(profile.fullName)
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [specialRequest, setSpecialRequest] = useState('')
  const [promoCode, setPromoCode] = useState('')

  // Phase 8 — quote is computed server-side. Pass it to calculatePrice so
  // baseSubtotal reflects any active seasonal rates for the stay window.
  // Phase 12 — also pass `settings` so the preview matches the live
  // `hotel_settings.tax_rate` / `resort_fee` the server action will use.
  const price = useMemo(
    () =>
      calculatePrice({
        basePrice: room.base_price,
        checkIn,
        checkOut,
        guests,
        quote,
      }, settings),
    [room.base_price, checkIn, checkOut, guests, quote, settings]
  )
  const nights = quote.nights

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await createBooking({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        guests,
        bookerFullName: fullName,
        bookerEmail: email,
        bookerPhone: phone || undefined,
        specialRequest: specialRequest || undefined,
        promoCode: promoCode || undefined,
      })

      if (result.error) {
        setState({ error: result.error })
        return
      }

      if (result.bookingId) {
        router.push(`/bookings/${result.bookingId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-8">
      {/* LEFT: Form fields */}
      <div className="flex flex-col gap-6">
        {state?.error && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
            {state.error}
          </div>
        )}

        {minNightsBlocked && (
          <div className="px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg text-body-md text-warning">
            เรทฤดูกาลที่ใช้อยู่กำหนดจำนวนคืนขั้นต่ำมากกว่าที่เลือก กรุณาเปลี่ยนวันที่หรือเลือกห้องอื่น
          </div>
        )}

        {/* Booker info */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ข้อมูลผู้จอง</h2>
          <div className="flex flex-col gap-4">
            <Field label="ชื่อ-นามสกุล" required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </Field>
            <Field label="อีเมล" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </Field>
            <Field label="เบอร์โทรศัพท์">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
              />
            </Field>
            <Field label="คำขอพิเศษ (ไม่บังคับ)">
              <textarea
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                rows={3}
                placeholder="เช่น ขอเตียงเสริม, แพ้อาหาร, เช็คอินดึก..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors resize-none"
              />
            </Field>
          </div>
        </section>

        {/* Promo code */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">รหัสโปรโมชั่น (ไม่บังคับ)</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="EARLY15"
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
            />
            <button
              type="button"
              className="px-6 py-3 border border-primary text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary hover:text-secondary transition-colors"
            >
              ใช้โค้ด
            </button>
          </div>
        </section>
      </div>

      {/* RIGHT: Sticky summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant overflow-hidden">
          {/* Room image */}
          <div className="relative aspect-[16/10] bg-surface-container">
            <Image
              src={r2Url(room.hero_image_key)}
              alt={room.name}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>

          <div className="p-6">
            <h3 className="font-display text-xl text-primary">{room.name_th}</h3>

            <div className="mt-4 flex flex-col gap-2 text-body-md">
              <SummaryRow icon="event" label="เช็คอิน" value={formatDate(checkIn)} />
              <SummaryRow icon="event" label="เช็คเอาท์" value={formatDate(checkOut)} />
              <SummaryRow icon="schedule" label="จำนวนคืน" value={`${nights} คืน`} />
              <SummaryRow icon="group" label="ผู้เข้าพัก" value={`${guests} ท่าน`} />
            </div>

            <div className="my-4 border-t border-outline-variant" />

            <div className="flex flex-col gap-2 text-body-md">
              {quote.appliedRates.length > 0 ? (
                <>
                  <PriceRow label={`${formatTHB(room.base_price)} × ${nights} คืน (ราคาฐาน)`} value={formatTHB(nights * room.base_price)} />
                  {quote.appliedRates.map((applied) => (
                    <div key={applied.id} className="ml-4 flex flex-col gap-1 text-caption text-on-surface-variant">
                      <span className="italic">• {applied.label} · {applied.nights} คืน</span>
                      {applied.minNightsOverride != null && (
                        <span className="text-warning">ขั้นต่ำ {applied.minNightsOverride} คืน</span>
                      )}
                    </div>
                  ))}
                  <PriceRow label="รวมค่าห้อง (รวมเรทฤดูกาล)" value={formatTHB(price.baseSubtotal)} emphasis />
                </>
              ) : (
                <PriceRow label={`${formatTHB(room.base_price)} × ${nights} คืน`} value={formatTHB(price.baseSubtotal)} />
              )}
              <PriceRow label={`ภาษี ${Math.round(settings.taxRate * 100)}%`} value={formatTHB(price.taxTotal)} />
              <PriceRow label={`ค่าบริการรีสอร์ท (${formatTHB(settings.resortFeePerNight)}/คืน)`} value={formatTHB(price.feeTotal)} />
            </div>

            <div className="my-4 border-t border-outline-variant" />
            <PriceRow label="รวมทั้งสิ้น" value={formatTHB(price.total)} emphasis />

            <SubmitButton disabled={isPending || nights === 0 || minNightsBlocked} />

            <p className="mt-4 text-caption text-on-surface-variant text-center">
              ระบบจะแสดงหน้ายืนยันเมื่อสร้างการจองสำเร็จ
            </p>
          </div>
        </div>
      </div>
    </form>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <MaterialIcon name={icon} size={18} className="text-primary" />
      <span className="text-on-surface-variant">{label}</span>
      <span className="ml-auto font-medium text-on-surface">{value}</span>
    </div>
  )
}

function PriceRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasis ? 'text-body-md font-bold text-primary' : 'text-body-md text-on-surface-variant'}>
        {label}
      </span>
      <span className={emphasis ? 'text-lg font-display font-bold text-primary' : 'text-body-md text-on-surface'}>
        {value}
      </span>
    </div>
  )
}
