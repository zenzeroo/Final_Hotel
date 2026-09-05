'use client'

import { useState } from 'react'
import { deactivateAccountAction } from '@/app/actions/account'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface DeactivateAccountSectionProps {
  fullName: string | null
}

/**
 * Danger Zone — soft-delete (deactivate) the user's own account.
 * Mirrors the mockup: user must type the exact text "ลบบัญชี" to
 * enable the confirm button. The action flips `is_active = false`
 * and signs the user out.
 *
 * Server action throws a redirect from `signOut()` after success; the
 * browser navigates to `/`.
 */
export function DeactivateAccountSection({ fullName }: DeactivateAccountSectionProps) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expected = 'ลบบัญชี'
  const isConfirmable = confirmText === expected && !submitting

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    setSubmitting(true)
    try {
      const result = await deactivateAccountAction(null, formData)
      // On success the action redirects; the catch below only fires on
      // validation / data errors. Reaching here at all is a failure path.
      if (result && !result.ok) {
        setError(result.error)
        setSubmitting(false)
      }
    } catch {
      // Expected: redirect to "/" interrupts the render. Nothing to do.
    }
  }

  return (
    <div className="bg-error-container/30 rounded-xl p-gutter md:p-[32px] border border-error-container">
      <h3 className="font-headline-sm text-headline-sm text-on-error-container mb-2">
        ลบบัญชีผู้ใช้
      </h3>
      <p className="text-on-surface-variant text-body-md mb-gutter">
        การลบบัญชีจะไม่สามารถย้อนกลับได้
        {fullName ? ` (${fullName})` : ''}{' '}
        และประวัติการจองทั้งหมดจะถูกซ่อนถาวร
      </p>
      {error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error mb-gutter">
          {error}
        </div>
      )}
      <form action={handleSubmit} className="flex flex-col gap-gutter">
        <label className="flex flex-col gap-2">
          <span className="font-label-md text-label-md text-on-surface">
            พิมพ์ <span className="font-mono text-error">{expected}</span>{' '}
            เพื่อยืนยัน
          </span>
          <input
            type="text"
            name="confirmText"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-error focus:ring-1 focus:ring-error transition-colors"
            placeholder={expected}
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isConfirmable}
            className="bg-transparent border border-error text-error px-6 py-2 rounded-full font-label-md text-label-md hover:bg-error hover:text-on-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <MaterialIcon name="delete_forever" size={18} />
            {submitting ? 'กำลังลบ…' : 'ลบบัญชีของฉัน'}
          </button>
        </div>
      </form>
    </div>
  )
}