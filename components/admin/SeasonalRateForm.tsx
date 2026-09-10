'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { RoomType } from '@/lib/data/types'
import { createSeasonalRateAction } from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface SeasonalRateFormProps {
  roomTypes: RoomType[]
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

function SubmitButton({ label }: { label: string }) {
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
        label
      )}
    </button>
  )
}

export function SeasonalRateForm({ roomTypes }: SeasonalRateFormProps) {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await createSeasonalRateAction(formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  if (roomTypes.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex items-start gap-3 border border-secondary/30 bg-secondary-container/30">
        <MaterialIcon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
        <div>
          <p className="text-body-md text-on-surface font-medium">
            กรุณาสร้างประเภทห้องอย่างน้อย 1 ประเภทก่อน
          </p>
          <p className="text-caption text-on-surface-variant mt-1">
            เพื่อผูกช่วงลดราคากับประเภทห้อง
          </p>
        </div>
      </div>
    )
  }

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
          บันทึกสำเร็จ
        </div>
      )}

      <Field label="ประเภทห้อง" required>
        <select
          name="room_type_id"
          required
          className={inputClass}
        >
          <option value="">— เลือกประเภทห้อง —</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name} ({rt.name_th})
            </option>
          ))}
        </select>
      </Field>

      <Field label="ชื่อช่วงราคา" required>
        <input
          name="label"
          type="text"
          placeholder="High Season 2026"
          required
          maxLength={120}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="วันเริ่มต้น" required>
          <input
            name="start_date"
            type="date"
            required
            className={inputClass}
          />
        </Field>
        <Field label="วันสิ้นสุด" required>
          <input
            name="end_date"
            type="date"
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ราคาคงที่ (THB/คืน)">
          <input
            name="flat_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="เว้นว่างถ้าใช้ตัวคูณ"
            className={inputClass}
          />
        </Field>
        <Field label="ตัวคูณราคา (เช่น 1.25)">
          <input
            name="price_multiplier"
            type="number"
            min="0"
            step="0.01"
            placeholder="เว้นว่างถ้าใช้ราคาคงที่"
            className={inputClass}
          />
        </Field>
      </div>

      <p className="text-caption text-on-surface-variant -mt-3">
        * ต้องระบุอย่างใดอย่างหนึ่ง (ราคาคงที่ หรือ ตัวคูณราคา)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="คืนขั้นต่ำ (override)">
          <input
            name="min_nights_override"
            type="number"
            min="1"
            max="60"
            step="1"
            placeholder="เว้นว่างถ้าไม่กำหนด"
            className={inputClass}
          />
        </Field>
        <Field label="Priority (สูงกว่าใช้แทน)">
          <input
            name="priority"
            type="number"
            min="0"
            max="1000"
            step="1"
            defaultValue={0}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="สถานะ">
        <label className="inline-flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked
            className="w-5 h-5 rounded border-outline-variant"
          />
          <span className="text-body-md text-on-surface">เปิดใช้งานช่วงราคานี้</span>
        </label>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label="สร้างช่วงราคา" />
        <a
          href="/admin/promotions"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
