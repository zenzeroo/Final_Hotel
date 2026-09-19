'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { suspendCustomerAction } from '@/app/actions/admin/customers'

interface SuspendCustomerButtonProps {
  customerId: string
  customerName: string | null
}

/**
 * Phase 36 — Modal trigger that suspends a customer account.
 *
 * UX:
 * - Trigger button (red "ระงับบัญชี")
 * - Modal opens → optional reason textarea → confirm
 * - Action flips is_suspended=true, suspended_at=now(), suspended_reason=...
 * - Audit row written to booking_events
 * - Page refreshes via revalidatePath in the action
 *
 * Self-protection: never rendered for own profile (caller filters
 * via getSession check). Server action also double-checks.
 */
export function SuspendCustomerButton({
  customerId,
  customerName,
}: SuspendCustomerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  function handleClose() {
    if (isPending) return
    setIsOpen(false)
    setTimeout(() => {
      setError(null)
      setReason('')
    }, 200)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await suspendCustomerAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      handleClose()
    })
  }

  const displayName = customerName ?? 'ลูกค้ารายนี้'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-error text-on-error rounded-lg hover:bg-error-container hover:text-error transition-colors"
      >
        <MaterialIcon name="block" size={18} />
        ระงับบัญชี
      </button>
      <Modal
        open={isOpen}
        onClose={handleClose}
        title="ยืนยันระงับบัญชี"
        maxWidthClass="max-w-lg"
        showCloseButton
        closeOnBackdrop={!isPending}
        body={
          <form
            id="suspend-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="customerId" value={customerId} />
            {error && (
              <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
                {error}
              </div>
            )}
            <p className="text-body-md text-on-surface">
              ระงับบัญชีของ <strong>{displayName}</strong>? ลูกค้าจะไม่สามารถ
              เข้าสู่ระบบหรือทำการจองใหม่ได้จนกว่าจะปลดการระงับ
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-label-md text-on-surface">
                เหตุผล (ไม่บังคับ)
              </span>
              <textarea
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="เช่น ลูกค้าทำผิดนโยบาย, พฤติกรรมไม่เหมาะสม..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md focus:border-error focus:ring-1 focus:ring-error transition-colors"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="bg-transparent border border-outline-variant text-on-surface-variant px-4 py-2 rounded-lg hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 bg-error text-on-error px-4 py-2 rounded-lg hover:bg-error-container hover:text-error transition-colors disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin" />
                    กำลังระงับ…
                  </>
                ) : (
                  <>
                    <MaterialIcon name="block" size={18} />
                    ยืนยันระงับบัญชี
                  </>
                )}
              </button>
            </div>
          </form>
        }
      />
    </>
  )
}
