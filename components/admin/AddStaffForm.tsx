'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createStaffAction } from '@/app/actions/admin/staff'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface FormState {
  error?: string
  success?: boolean
  initialPassword?: string
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
          กำลังเพิ่มพนักงาน…
        </>
      ) : (
        <>
          <MaterialIcon name="person_add" size={18} />
          เพิ่มพนักงาน
        </>
      )}
    </button>
  )
}

export function AddStaffForm() {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await createStaffAction(formData)
    if (!result.ok) return { error: result.error }
    return { success: true, initialPassword: result.data?.initialPassword }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  if (state?.success && state.initialPassword) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <div className="inline-flex items-center gap-2 text-body-lg text-secondary font-semibold mb-3">
          <MaterialIcon name="check_circle" size={20} />
          สร้างบัญชีพนักงานสำเร็จ
        </div>
        <p className="text-body-md text-on-surface mb-3">
          กรุณาส่งรหัสผ่านเริ่มต้นนี้ให้พนักงานด้วยตัวเอง (ระบบจะไม่แสดงอีก):
        </p>
        <div className="bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg font-mono text-body-lg mb-4">
          {state.initialPassword}
        </div>
        <a
          href="/admin/staff"
          className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary"
        >
          <MaterialIcon name="arrow_back" size={18} />
          กลับไปหน้ารายชื่อพนักงาน
        </a>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อ-นามสกุล" required>
          <input
            name="full_name"
            type="text"
            placeholder="สมชาย ใจดี"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="อีเมล" required>
          <input
            name="email"
            type="email"
            placeholder="newstaff@zenzero.com"
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="เบอร์โทร">
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            minLength={10}
            pattern="[0-9]{10}"
            placeholder="0987654321"
            onChange={(e) => {
              const target = e.currentTarget
              const cleaned = target.value.replace(/\D/g, '').slice(0, 10)
              if (cleaned !== target.value) target.value = cleaned
            }}
            className={inputClass}
          />
        </Field>

        <Field label="บทบาท" required>
          <select name="role" defaultValue="reception" className={inputClass}>
            <option value="reception">พนักงานต้อนรับ</option>
            <option value="housekeeper">พนักงานทำความสะอาด</option>
            <option value="manager">ผู้จัดการ</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
        </Field>
      </div>

      <Field label="รหัสผ่านเริ่มต้น (≥ 8 ตัวอักษร)" required>
        <input
          name="password"
          type="text"
          placeholder="เช่น Welcome2026!"
          required
          minLength={8}
          maxLength={72}
          className={`${inputClass} font-mono`}
        />
      </Field>

      <SubmitButton />
    </form>
  )
}
