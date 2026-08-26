'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn, type AuthState } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { PasswordInput } from '@/components/ui/PasswordInput'

interface LoginFormProps {
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
          กำลังเข้าสู่ระบบ…
        </>
      ) : (
        'เข้าสู่ระบบ'
      )}
    </button>
  )
}

export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction] = useActionState<AuthState | null, FormData>(signIn, null)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      )}

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

      {/* Password */}
      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-label-md text-on-surface">รหัสผ่าน</span>
          <a
            href="#"
            className="text-caption text-primary hover:text-secondary transition-colors"
          >
            ลืมรหัสผ่าน?
          </a>
        </div>
        <PasswordInput
          name="password"
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="current-password"
        />
      </label>

      <SubmitButton />

      {/* Divider */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-outline-variant" />
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">หรือ</span>
        <div className="flex-1 h-px bg-outline-variant" />
      </div>

      {/* Social buttons (UI only — wire up later) */}
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg text-body-md font-medium text-on-surface opacity-60 cursor-not-allowed"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>account_circle</span>
        เข้าสู่ระบบด้วย Google
      </button>
    </form>
  )
}
