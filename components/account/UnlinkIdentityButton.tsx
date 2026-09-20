'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  unlinkIdentityAction,
  type AccountIdentityActionResult,
} from '@/app/actions/identity-link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'

function SubmitButton({ locale }: { locale: 'th' | 'en' }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-label-md uppercase tracking-wider bg-error text-on-primary px-6 py-3 hover:bg-error/90 disabled:opacity-50 transition-colors"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
          {locale === 'en' ? 'Disconnecting…' : 'กำลังยกเลิก…'}
        </>
      ) : locale === 'en' ? (
        'Disconnect'
      ) : (
        'ยกเลิกการเชื่อมต่อ'
      )}
    </button>
  )
}

/**
 * Phase 37 — Unlink-identity button + confirmation modal.
 * Modal uses form-in-body pattern: SubmitButton is inside the body
 * <form> so server action can complete the unlink + trigger revalidate.
 *
 * @param methodLabel — display name for the identity being unlinked
 *                      (e.g. "Google", "Email/Password") — used in
 *                      confirm message.
 */
export function UnlinkIdentityButton({
  identityId,
  methodLabel,
  locale,
}: {
  identityId: string
  methodLabel: string
  locale: 'th' | 'en'
}) {
  const [open, setOpen] = useState(false)
  const confirmCopy =
    locale === 'en'
      ? `Disconnect ${methodLabel}? You'll still be able to sign in with other methods linked to your account.`
      : `ยกเลิกการเชื่อมต่อ ${methodLabel}? คุณยังสามารถเข้าสู่ระบบด้วยวิธีอื่นที่เชื่อมต่ออยู่`

  const wrapped = async (
    _state: AccountIdentityActionResult | null,
    formData: FormData,
  ): Promise<AccountIdentityActionResult> => {
    const result = await unlinkIdentityAction(null, formData)
    if (result.ok) setOpen(false)
    return result
  }

  const [state, formAction] = useActionState<AccountIdentityActionResult | null, FormData>(
    wrapped,
    null,
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-transparent border border-outline-variant text-on-surface-variant px-3 py-1 rounded-full font-caption text-caption hover:bg-error-container hover:text-error hover:border-error transition-colors"
      >
        <MaterialIcon name="link_off" size={14} className="inline-block mr-1" />
        {locale === 'en' ? 'Disconnect' : 'ยกเลิกการเชื่อมต่อ'}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={locale === 'en' ? 'Disconnect sign-in method' : 'ยกเลิกการเชื่อมต่อ'}
        showCloseButton
        body={
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="identityId" value={identityId} />
            <p className="text-body-md text-on-surface">{confirmCopy}</p>
            {state && !state.ok && state.error && (
              <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-sm text-error">
                {state.error}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-6 py-3 rounded-lg font-semibold text-label-md uppercase tracking-wider border border-outline text-on-surface hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
              >
                {locale === 'en' ? 'Cancel' : 'ยกเลิก'}
              </button>
              <SubmitButton locale={locale} />
            </div>
          </form>
        }
      />
    </>
  )
}
