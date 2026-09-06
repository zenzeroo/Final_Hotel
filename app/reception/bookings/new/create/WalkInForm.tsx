'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useMemo } from 'react'
import { createWalkInBooking } from '@/app/actions/walk-in-booking'
import { calculateNights, calculatePrice, formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface WalkInFormProps {
  room: {
    id: string
    slug: string
    name: string
    name_th: string
    hero_image_key: string
    base_price: number
    max_guests: number
  }
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

function getTomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function WalkInForm({ room }: WalkInFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState(getTodayIso)
  const [checkOut, setCheckOut] = useState(getTomorrowIso)
  const [guests, setGuests] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialRequest, setSpecialRequest] = useState('')
  // Phase 17 — replaces `markAsPaid` boolean. `card` triggers a Stripe
  // Checkout redirect in the submit handler. `unpaid` is for "pay later"
  // walk-ins (folio created, payment collected later at desk).
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'unpaid'>('cash')

  const nights = useMemo(() => calculateNights(checkIn, checkOut), [checkIn, checkOut])
  const price = useMemo(
    () =>
      calculatePrice({
        basePrice: room.base_price,
        checkIn,
        checkOut,
        guests,
      }),
    [room.base_price, checkIn, checkOut, guests]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // Walk-in guests have no auth.users row — the dedicated server action
      // uses the service role to find or create the guest's account, then
      // inserts the booking with channel='walk_in' + payment_status=paid/unpaid.
      const result = await createWalkInBooking({
        roomTypeId: room.id,
        checkIn,
        checkOut,
        guests,
        bookerFullName: fullName,
        bookerEmail: email,
        bookerPhone: phone,
        specialRequest: specialRequest || undefined,
        paymentMethod,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push(`/reception/bookings?status=all`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* LEFT: form */}
      <div className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
            {error}
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">ข้อมูลลูกค้า</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="ชื่อ-นามสกุล" required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="อีเมล" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="เบอร์โทรศัพท์" required>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                minLength={10}
                required
                pattern="[0-9]{10}"
                placeholder="08xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
              />
              <p className="font-caption text-caption text-on-surface-variant">
                ต้องเป็นตัวเลข 10 หลักเท่านั้น (ไม่มีขีด ไม่มีช่องว่าง)
              </p>
            </Field>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">วันที่เข้าพัก</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="เช็คอิน" required>
              <input
                type="date"
                value={checkIn}
                min={getTodayIso()}
                onChange={(e) => {
                  setCheckIn(e.target.value)
                  if (e.target.value >= checkOut) {
                    const next = new Date(e.target.value)
                    next.setDate(next.getDate() + 1)
                    setCheckOut(next.toISOString().slice(0, 10))
                  }
                }}
                className="input"
              />
            </Field>
            <Field label="เช็คเอาท์" required>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="ผู้เข้าพัก" required>
              <input
                type="number"
                min={1}
                max={room.max_guests}
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value, 10) || 1)}
                className="input"
              />
            </Field>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <h2 className="font-display text-xl text-primary mb-4">คำขอพิเศษ</h2>
          <textarea
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
            rows={3}
            placeholder="เช่น เตียงเสริม, แพ้อาหาร..."
            className="input resize-none w-full"
          />
        </div>

        <fieldset className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4">
          <legend className="px-2 text-label-md text-on-surface font-semibold">
            วิธีชำระเงิน
          </legend>
          <div className="flex flex-col gap-2">
            <PaymentOption
              value="cash"
              label="เงินสด"
              description="ลูกค้าชำระ ณ ตอนนี้ — ระบบบันทึกสถานะชำระเงินแล้วทันที"
              selected={paymentMethod === 'cash'}
              onSelect={() => setPaymentMethod('cash')}
            />
            <PaymentOption
              value="card"
              label="บัตรเครดิต / PromptPay"
              description="เปิดหน้า Stripe Checkout เพื่อรับชำระเงินออนไลน์"
              selected={paymentMethod === 'card'}
              onSelect={() => setPaymentMethod('card')}
            />
            <PaymentOption
              value="unpaid"
              label="ชำระภายหลัง"
              description="สร้างการจองไว้ก่อน — เก็บเงินที่เคาน์เตอร์ในภายหลัง"
              selected={paymentMethod === 'unpaid'}
              onSelect={() => setPaymentMethod('unpaid')}
            />
          </div>
        </fieldset>
      </div>

      {/* RIGHT: summary */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) border border-outline-variant p-6">
          <h2 className="font-display text-lg text-primary mb-3">{room.name_th}</h2>
          <div className="space-y-2 text-body-md">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">{formatTHB(room.base_price)} × {nights} คืน</span>
              <span className="text-on-surface">{formatTHB(price.baseSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">ภาษี</span>
              <span className="text-on-surface">{formatTHB(price.taxTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">ค่าบริการรีสอร์ท</span>
              <span className="text-on-surface">{formatTHB(price.feeTotal)}</span>
            </div>
          </div>
          <div className="my-4 border-t border-outline-variant" />
          <div className="flex justify-between items-baseline">
            <span className="text-body-md font-bold text-primary">รวมทั้งสิ้น</span>
            <span className="text-2xl font-display font-bold text-primary">{formatTHB(price.total)}</span>
          </div>

          <button
            type="submit"
            disabled={isPending || nights === 0 || !fullName || !email || !phone}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                กำลังสร้าง…
              </>
            ) : (
              <>
                <MaterialIcon name="check_circle" size={18} />
                ยืนยันการจอง
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--color-surface-container-low);
          border: 1px solid var(--color-outline-variant);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          color: var(--color-on-surface);
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: var(--color-secondary);
          box-shadow: 0 0 0 1px var(--color-secondary);
        }
      `}</style>
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

function PaymentOption({
  value,
  label,
  description,
  selected,
  onSelect,
}: {
  value: 'cash' | 'card' | 'unpaid'
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-outline-variant hover:bg-surface-container-low'
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="mt-1 w-4 h-4 accent-primary"
      />
      <div className="flex flex-col">
        <span className="text-body-md font-semibold text-on-surface">{label}</span>
        <span className="text-body-sm text-on-surface-variant">{description}</span>
      </div>
    </label>
  )
}
