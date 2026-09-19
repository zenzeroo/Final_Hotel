'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { unsuspendCustomerAction } from '@/app/actions/admin/customers'

interface UnsuspendCustomerButtonProps {
  customerId: string
  customerName: string | null
}

/**
 * Phase 36 — Modal trigger that unsuspends a customer account.
 *
 * Lighter than SuspendCustomerButton — no reason input needed.
 * Confirmation modal asks once, then flips is_suspended=false +
 * clears suspended_at + suspended_reason. Audit row written.
 */
export function UnsuspendCustomerButton({
  customerId,
  customerName,
}: UnsuspendCustomerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    const fd = new FormData()
    fd.set('customerId', customerId)
    startTransition(async () => {
      const result = await unsuspendCustomerAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setIsOpen(false)
    })
  }

  const displayName = customerName ?? 'ลูกค้ารายนี้'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-container hover:text-secondary transition-colors"
      >
        <MaterialIcon name="check_circle" size={18} />
        ปลดการระงับ
      </button>
      <ConfirmModal
        open={isOpen}
        onCancel={() => {
          if (isPending) return
          setIsOpen(false)
          setError(null)
        }}
        onConfirm={handleConfirm}
        title="ยืนยันปลดการระงับ"
        body={
          <div className="flex flex-col gap-3">
            {error && (
              <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
                {error}
              </div>
            )}
            <p className="text-body-md text-on-surface">
              ปลดการระงับบัญชีของ <strong>{displayName}</strong>? ลูกค้า
              จะสามารถเข้าสู่ระบบและทำการจองได้ตามปกติ
            </p>
            {isPending && (
              <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                กำลังดำเนินการ…
              </div>
            )}
          </div>
        }
        okLabel={isPending ? 'กำลังดำเนินการ…' : 'ยืนยันปลดการระงับ'}
        cancelLabel="ยกเลิก"
      />
    </>
  )
}
