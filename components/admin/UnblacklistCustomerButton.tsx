'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { unblacklistCustomerAction } from '@/app/actions/admin/customers'
import { useT } from '@/lib/i18n/useT'

interface UnblacklistCustomerButtonProps {
  customerId: string
  customerName: string | null
}

/**
 * Confirmation modal that removes a customer from the blacklist
 * (cloned from UnsuspendCustomerButton). Audit row written.
 */
export function UnblacklistCustomerButton({
  customerId,
  customerName,
}: UnblacklistCustomerButtonProps) {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    const fd = new FormData()
    fd.set('customerId', customerId)
    startTransition(async () => {
      const result = await unblacklistCustomerAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setIsOpen(false)
    })
  }

  const displayName = customerName ?? t('admin.customersPage.thisCustomer')

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-container hover:text-secondary transition-colors"
      >
        <MaterialIcon name="verified_user" size={18} />
        {t('admin.customersPage.unblacklist')}
      </button>
      <ConfirmModal
        open={isOpen}
        onCancel={() => {
          if (isPending) return
          setIsOpen(false)
          setError(null)
        }}
        onConfirm={handleConfirm}
        title={t('admin.customersPage.confirmUnblacklist')}
        body={
          <div className="flex flex-col gap-3">
            {error && (
              <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
                {error}
              </div>
            )}
            <p className="text-body-md text-on-surface">
              {t('admin.customersPage.unblacklistBody', { name: displayName })}
            </p>
            {isPending && (
              <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                {t('admin.customersPage.processing')}
              </div>
            )}
          </div>
        }
        okLabel={isPending ? t('admin.customersPage.processing') : t('admin.customersPage.confirmUnblacklist')}
        cancelLabel={t('admin.common.cancel')}
      />
    </>
  )
}
