'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signUp, type AuthState } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RegisterFormProps {
  next: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังสมัครสมาชิก…
        </>
      ) : (
        'สมัครสมาชิก'
      )}
    </button>
  )
}

export function RegisterForm({ next }: RegisterFormProps) {
  const [state, formAction] = useActionState<AuthState | null, FormData>(signUp, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      )}

      {/* Full name */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">ชื่อ-นามสกุล</span>
        <div className="relative">
          <MaterialIcon
            name="person"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            name="full_name"
            placeholder="คุณสมชาย ใจดี"
            required
            autoComplete="name"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Email */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">อีเมล</span>
        <div className="relative">
          <MaterialIcon
            name="mail"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="email"
            name="email"
            placeholder="example@gmail.com"
            required
            autoComplete="email"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Phone */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">
          เบอร์โทรศัพท์ <span className="text-on-surface-variant normal-case font-normal">(ไม่บังคับ)</span>
        </span>
        <div className="relative">
          <MaterialIcon
            name="phone"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="tel"
            name="phone"
            placeholder="08x-xxx-xxxx"
            autoComplete="tel"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">รหัสผ่าน</span>
        <div className="relative">
          <MaterialIcon
            name="lock"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="password"
            name="password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      {/* Confirm password */}
      <label className="flex flex-col gap-1.5">
        <span className="text-label-md text-on-surface">ยืนยันรหัสผ่าน</span>
        <div className="relative">
          <MaterialIcon
            name="lock"
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="password"
            name="confirm_password"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
          />
        </div>
      </label>

      <SubmitButton />
    </form>
  )
}
