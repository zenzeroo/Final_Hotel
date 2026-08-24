'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { RoomType } from '@/lib/data/types'
import { createRoomTypeAction, updateRoomTypeAction } from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomTypeFormProps {
  mode: 'create' | 'edit'
  initial?: RoomType
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

export function RoomTypeForm({ mode, initial }: RoomTypeFormProps) {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const rawAction = mode === 'create' ? createRoomTypeAction : updateRoomTypeAction
    const result = await rawAction(formData)
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
          บันทึกสำเร็จ
        </div>
      )}

      {mode === 'edit' && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug (URL-friendly)" required>
          <input
            name="slug"
            type="text"
            defaultValue={initial?.slug ?? ''}
            placeholder="deluxe-garden-view"
            required
            maxLength={80}
            pattern="[a-z0-9\-]+"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="ราคาฐาน (THB/คืน)" required>
          <input
            name="base_price"
            type="number"
            min="1"
            step="0.01"
            defaultValue={initial?.base_price ?? 3000}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อห้อง (EN)" required>
          <input
            name="name"
            type="text"
            defaultValue={initial?.name ?? ''}
            placeholder="Deluxe Garden View"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="ชื่อห้อง (TH)" required>
          <input
            name="name_th"
            type="text"
            defaultValue={initial?.name_th ?? ''}
            placeholder="ห้องดีลักซ์วิวสวน"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="คำอธิบายสั้น" required>
        <input
          name="short_desc"
          type="text"
          defaultValue={initial?.short_desc ?? ''}
          required
          maxLength={300}
          className={inputClass}
        />
      </Field>

      <Field label="คำอธิบายเต็ม" required>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ''}
          required
          maxLength={2000}
          rows={3}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="จำนวนผู้เข้าพักสูงสุด" required>
          <input
            name="max_guests"
            type="number"
            min="1"
            max="20"
            step="1"
            defaultValue={initial?.max_guests ?? 2}
            required
            className={inputClass}
          />
        </Field>

        <Field label="ขนาดห้อง (ตร.ม.)" required>
          <input
            name="size_sqm"
            type="number"
            min="1"
            step="0.1"
            defaultValue={initial?.size_sqm ?? 30}
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
            defaultChecked={initial?.is_active ?? true}
            className="w-5 h-5 rounded border-outline-variant"
          />
          <span className="text-body-md text-on-surface">เปิดให้จอง</span>
        </label>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={mode === 'create' ? 'สร้างประเภทห้อง' : 'บันทึกการแก้ไข'} />
        <a
          href="/admin/rates"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-surface-container-high transition-colors"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
