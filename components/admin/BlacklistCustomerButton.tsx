'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { blacklistCustomerAction } from '@/app/actions/admin/customers'
import { useT } from '@/lib/i18n/useT'

interface BlacklistCustomerButtonProps {
  customerId: string
  customerName: string | null
}

/**
 * Modal trigger that blacklists a customer (cloned from
 * SuspendCustomerButton). The customer keeps sign-in access, but online
 * booking is refused and each attempt notifies reception.
 */
export function BlacklistCustomerButton({
  customerId,
  customerName,
}: BlacklistCustomerButtonProps) {
  const t = useT()
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
      const result = await blacklistCustomerAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      handleClose()
    })
  }

  const displayName = customerName ?? t('admin.customersPage.thisCustomer')

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-on-surface text-surface rounded-lg hover:bg-error hover:text-on-error transition-colors"
      >
        <MaterialIcon name="gpp_bad" size={18} />
        {t('admin.customersPage.blacklist')}
      </button>
      <Modal
        open={isOpen}
        onClose={handleClose}
        title={t('admin.customersPage.confirmBlacklist')}
        maxWidthClass="max-w-lg"
        showCloseButton
        closeOnBackdrop={!isPending}
        body={
          <form
            id="blacklist-form"
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
              {t('admin.customersPage.blacklistBody', { name: displayName })}
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-label-md text-on-surface">
                {t('admin.customersPage.blacklistReason')}
              </span>
              <textarea
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('admin.customersPage.blacklistPlaceholder')}
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
                {t('admin.common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 bg-error text-on-error px-4 py-2 rounded-lg hover:bg-error-container hover:text-error transition-colors disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin" />
                    {t('admin.customersPage.blacklisting')}
                  </>
                ) : (
                  <>
                    <MaterialIcon name="gpp_bad" size={18} />
                    {t('admin.customersPage.confirmBlacklist')}
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
