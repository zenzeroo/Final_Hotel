'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { changePasswordAction } from '@/app/actions/account'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PasswordInput } from '@/components/ui/PasswordInput'

interface FormState {
  error?: string
  success?: boolean
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังเปลี่ยน…
        </>
      ) : (
        'เปลี่ยนรหัสผ่าน'
      )}
    </button>
  )
}

/**
 * ChangePasswordForm — collapsed Security card on /account/profile.
 * Mirrors the mockup: click "แก้ไขรหัสผ่าน" to expand the form (current +
 * new + confirm), submit, then collapse again on success.
 */
export function ChangePasswordForm() {
  const [open, setEditing] = useState(false)

  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await changePasswordAction(null, formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  if (!open) {
    return (
      <div className="flex justify-between items-center bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container p-gutter md:p-[32px]">
        <h3 className="font-headline-sm text-headline-sm text-primary">ความปลอดภัย</h3>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="bg-transparent border border-primary text-primary px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:border-primary-fixed transition-colors"
        >
          แก้ไขรหัสผ่าน
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container">
      <h3 className="font-headline-sm text-headline-sm text-primary p-gutter md:p-[32px] pb-base">
        แก้ไขรหัสผ่าน
      </h3>
      <form
        action={async (formData) => {
          await formAction(formData)
          // Collapse after a successful submit.
          if (!state?.error) setEditing(false)
        }}
        className="px-gutter md:px-[32px] pb-gutter md:pb-[32px] flex flex-col gap-5"
      >
        {state?.error && (
          <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
            <MaterialIcon name="check_circle" size={18} />
            เปลี่ยนรหัสผ่านสำเร็จ
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <PasswordInput
            name="currentPassword"
            placeholder="กรอกรหัสผ่านปัจจุบัน"
            autoComplete="current-password"
            required
          />
          <PasswordInput
            name="newPassword"
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
          <PasswordInput
            name="confirmNewPassword"
            placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </div>
        <div className="flex justify-end gap-3 mt-2 pt-gutter border-t border-surface-container">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="bg-transparent border border-outline-variant text-on-surface-variant px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
          >
            ยกเลิก
          </button>
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}