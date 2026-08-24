'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { StaffMember } from '@/lib/data/types'
import { updateStaffAction } from '@/app/actions/admin/staff'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface StaffFormProps {
  staff: StaffMember
  isSelf: boolean
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
        'บันทึกการแก้ไข'
      )}
    </button>
  )
}

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  reception: 'พนักงานต้อนรับ',
  housekeeper: 'พนักงานทำความสะอาด',
  manager: 'ผู้จัดการ',
  admin: 'ผู้ดูแลระบบ',
}

export function StaffForm({ staff, isSelf }: StaffFormProps) {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await updateStaffAction(formData)
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

      <input type="hidden" name="id" value={staff.id} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อ-นามสกุล" required>
          <input
            name="full_name"
            type="text"
            defaultValue={staff.full_name}
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="อีเมล (อ่านอย่างเดียว)">
          <input
            type="email"
            value={staff.email}
            disabled
            className={`${inputClass} opacity-60 cursor-not-allowed`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="เบอร์โทร">
          <input
            name="phone"
            type="tel"
            defaultValue={staff.phone ?? ''}
            maxLength={40}
            className={inputClass}
          />
        </Field>

        <Field label="บทบาท" required>
          <select
            name="role"
            defaultValue={staff.role}
            disabled={isSelf}
            className={`${inputClass} ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <option value="reception">{ROLE_LABEL.reception}</option>
            <option value="housekeeper">{ROLE_LABEL.housekeeper}</option>
            <option value="manager">{ROLE_LABEL.manager}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
        </Field>
      </div>

      <Field label="สถานะ">
        <label className="inline-flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={staff.is_active}
            disabled={isSelf}
            className="w-5 h-5 rounded border-outline-variant disabled:opacity-60"
          />
          <span className="text-body-md text-on-surface">ใช้งานอยู่</span>
        </label>
        {isSelf && (
          <p className="text-caption text-on-surface-variant mt-1">
            ไม่สามารถเปลี่ยนบทบาทหรือปิดใช้งานบัญชีตัวเองได้
          </p>
        )}
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <a
          href="/admin/staff"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-surface-container-high transition-colors"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
