'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import type { Promotion, RoomTypeName } from '@/lib/data/types'
import {
  createPromotionAction,
  updatePromotionAction,
} from '@/app/actions/promotions'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { getTodayLocalIso } from '@/lib/dates'
import { r2Url } from '@/lib/r2/publicUrl'

interface PromotionFormProps {
  mode: 'create' | 'edit'
  initial?: Promotion
  roomTypes: RoomTypeName[]
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

export function PromotionForm({ mode, initial, roomTypes }: PromotionFormProps) {
  // Track valid_from so valid_until's `min` can follow it (otherwise
  // min would have to read the DOM element or be a fixed date).
  const [validFrom, setValidFrom] = useState<string>(initial?.valid_from ?? '')
  // Phase 27 — track discount_type so labels + max-cap field can
  // switch semantics between percent and flat.
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>(
    initial?.discount_type ?? 'percent',
  )
  // Phase 43 — track if user opted to remove the existing hero image.
  // Default false so the existing image stays unless explicitly cleared.
  const [removeImage, setRemoveImage] = useState(false)

  // useActionState requires (state, payload) => newState signature.
  // The raw action takes only FormData, so wrap it.
  const wrappedAction = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const rawAction = mode === 'create' ? createPromotionAction : updatePromotionAction
    const result = await rawAction(formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrappedAction, null)

  return (
    <form action={formAction} className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-5">
      {state?.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      )}

      {mode === 'edit' && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="โค้ด" required>
          <input
            name="code"
            type="text"
            defaultValue={initial?.code ?? ''}
            placeholder="SUMMER25"
            required
            maxLength={40}
            className={inputClass}
          />
        </Field>

        <Field label="ชื่อโปรโมชั่น" required>
          <input
            name="name"
            type="text"
            defaultValue={initial?.name ?? ''}
            placeholder="ส่วนลดฤดูร้อน"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="คำอธิบาย">
        <textarea
          name="description"
          defaultValue={initial?.description ?? ''}
          rows={2}
          maxLength={500}
          placeholder="ส่วนลดพิเศษสำหรับการจองล่วงหน้า"
          className={inputClass}
        />
      </Field>

      {/* Phase 43 — optional hero image. Used by the homepage hero carousel
          when an admin picks this promotion as a slide source. Leave empty
          to keep the promotion text-only. */}
      <fieldset className="flex flex-col gap-3 border border-outline-variant rounded-2xl p-4">
        <legend className="text-caption text-on-surface-variant uppercase tracking-wider px-2 -ml-2">
          รูป Hero สำหรับหน้าแรก
        </legend>

        {/* Existing image preview */}
        {initial?.image_key && !removeImage && (
          <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-surface-container">
            <Image
              src={r2Url(initial.image_key)}
              alt="รูป Hero ปัจจุบัน"
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
          </div>
        )}

        <Field label={initial?.image_key && !removeImage ? 'อัปโหลดรูปใหม่ (จะแทนที่รูปเดิม)' : 'อัปโหลดรูป Hero'}>
          <input
            name="image_file"
            type="file"
            accept="image/*"
            className="block w-full text-body-md text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-on-primary file:cursor-pointer hover:file:bg-primary-fixed hover:file:text-primary"
          />
        </Field>

        {/* Hidden field — preserves the existing image_key across form
            submits when no new file is uploaded. */}
        {initial?.image_key && !removeImage && (
          <input type="hidden" name="image_key" value={initial.image_key} />
        )}

        {initial?.image_key && !removeImage && (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="removeImage"
              value="true"
              checked={removeImage}
              onChange={(e) => setRemoveImage(e.target.checked)}
              className="w-4 h-4 accent-error"
            />
            <span className="text-body-md text-error">ลบรูป Hero นี้</span>
          </label>
        )}

        <p className="text-caption text-on-surface-variant">
          รูปนี้จะใช้ในแครูเซลหน้าแรกเมื่อแอดมินเลือกโปรโมชั่นนี้เป็นสไลด์ — ไม่บังคับ
        </p>
      </fieldset>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="ประเภทส่วนลด" required>
          <select
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percent' | 'flat')}
            className={inputClass}
          >
            <option value="percent">เปอร์เซ็นต์ (%)</option>
            <option value="flat">จำนวนเงิน (THB)</option>
          </select>
        </Field>

        <Field label={discountType === 'percent' ? 'จำนวนเปอร์เซ็นต์' : 'มูลค่า'} required>
          <input
            name="discount_value"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={initial?.discount_value ?? (discountType === 'percent' ? 10 : 100)}
            required
            className={inputClass}
          />
        </Field>

        {discountType === 'percent' && (
          <Field label="ส่วนลดสูงสุด (บาท)">
            <input
              name="max_discount_amount"
              type="number"
              min="0"
              step="1"
              defaultValue={initial?.max_discount_amount ?? ''}
              placeholder="เว้นว่างไว้ = ไม่จำกัด"
              className={inputClass}
            />
          </Field>
        )}

        <Field label={discountType === 'flat' ? 'ราคารวมขั้นต่ำ (บาท)' : 'คืนขั้นต่ำ'} required>
          <input
            name="min_nights"
            type="number"
            min="1"
            max="30"
            step="1"
            defaultValue={initial?.min_nights ?? 1}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="วันเริ่มต้น" required>
          <DatePickerField
            name="valid_from"
            min={getTodayLocalIso()}
            defaultValue={initial?.valid_from ?? ''}
            onChange={(v) => setValidFrom(v)}
            required
          />
        </Field>

        <Field label="วันสิ้นสุด" required>
          <DatePickerField
            name="valid_until"
            min={validFrom || getTodayLocalIso()}
            defaultValue={initial?.valid_until ?? ''}
            required
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1">
          ใช้ได้กับห้องพัก
        </legend>
        <p className="text-caption text-on-surface-variant mb-2">
          เว้นว่างไว้ = ใช้ได้กับทุกประเภทห้อง
        </p>
        <div className="flex flex-wrap gap-3">
          {roomTypes.map((type) => (
            <label
              key={type}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-outline-variant cursor-pointer hover:bg-primary-fixed"
            >
              <input
                type="checkbox"
                name="applies_to_room_types"
                value={type}
                defaultChecked={
                  initial?.applies_to_room_types?.includes(type) ?? false
                }
                className="w-4 h-4 accent-primary"
              />
              <span className="text-body-md text-on-surface">{type}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="สถานะ">
        <label className="inline-flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={initial?.is_active ?? true}
            className="w-5 h-5 rounded border-outline-variant"
          />
          <span className="text-body-md text-on-surface">เปิดใช้งานทันที</span>
        </label>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={mode === 'create' ? 'สร้างโปรโมชั่น' : 'บันทึกการแก้ไข'} />
        <a
          href="/admin/promotions"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          ยกเลิก
        </a>
      </div>

      {state?.success && (
        <div className="inline-flex items-center gap-2 text-body-md text-secondary">
          <MaterialIcon name="check_circle" size={18} />
          บันทึกสำเร็จ
        </div>
      )}
    </form>
  )
}
