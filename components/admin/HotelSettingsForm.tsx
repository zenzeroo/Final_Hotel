'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { HotelSettings } from '@/lib/data/types'
import { updateHotelSettingsAction } from '@/app/actions/admin/settings'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface HotelSettingsFormProps {
  settings: HotelSettings
}

interface FormState {
  error?: string
  success?: boolean
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
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

const inputClass =
  'w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังบันทึก…
        </>
      ) : (
        <>
          <MaterialIcon name="save" size={18} />
          บันทึกการตั้งค่า
        </>
      )}
    </button>
  )
}

export function HotelSettingsForm({ settings }: HotelSettingsFormProps) {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await updateHotelSettingsAction(formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  return (
    <form action={formAction} className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-5">
      {state?.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="check_circle" size={18} />
          บันทึกการตั้งค่าเรียบร้อย
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อโรงแรม (EN)" required>
          <input
            name="name"
            type="text"
            defaultValue={settings.name}
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="ชื่อโรงแรม (TH)">
          <input
            name="name_th"
            type="text"
            defaultValue={settings.name_th ?? ''}
            maxLength={120}
            placeholder="โรงแรมเซนเซโร่"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="ที่อยู่" required>
        <textarea
          name="address"
          defaultValue={settings.address}
          required
          maxLength={500}
          rows={2}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="เบอร์โทรศัพท์" required>
          <input
            name="phone"
            type="tel"
            defaultValue={settings.phone}
            required
            maxLength={40}
            className={inputClass}
          />
        </Field>

        <Field label="อีเมล" required>
          <input
            name="email"
            type="email"
            defaultValue={settings.email}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="อัตราภาษี (0–1)" required>
          <input
            name="tax_rate"
            type="number"
            step="0.001"
            min="0"
            max="1"
            defaultValue={settings.tax_rate}
            required
            className={inputClass}
          />
        </Field>

        <Field label="ค่าบริการรีสอร์ท (THB)" required>
          <input
            name="resort_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.resort_fee}
            required
            className={inputClass}
          />
        </Field>

        <Field label="สกุลเงิน" required>
          <input
            name="currency"
            type="text"
            defaultValue={settings.currency}
            required
            maxLength={8}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="เช็คอิน (HH:MM)" required>
          <input
            name="check_in_time"
            type="time"
            defaultValue={settings.check_in_time}
            required
            className={inputClass}
          />
        </Field>

        <Field label="เช็คเอาท์ (HH:MM)" required>
          <input
            name="check_out_time"
            type="time"
            defaultValue={settings.check_out_time}
            required
            className={inputClass}
          />
        </Field>

        <Field label="ภาษาเริ่มต้น" required>
          <select
            name="locale_default"
            defaultValue={settings.locale_default}
            required
            className={inputClass}
          >
            <option value="th">ไทย (th)</option>
            <option value="en">English (en)</option>
          </select>
        </Field>
      </div>

      <Field label="คีย์รูป Hero ใน R2">
        <input
          name="hero_image_key"
          type="text"
          defaultValue={settings.hero_image_key ?? ''}
          maxLength={500}
          placeholder="rooms/hero/cover.jpg"
          className={`${inputClass} font-mono text-body-sm`}
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
      </div>

      <div className="text-caption text-on-surface-variant pt-4 border-t border-outline-variant">
        อัปเดตล่าสุดเมื่อ{' '}
        {new Date(settings.updated_at).toLocaleString('th-TH', {
          dateStyle: 'long',
          timeStyle: 'short',
        })}
        {settings.updated_by && ` (โดย ${settings.updated_by})`}
      </div>
    </form>
  )
}
