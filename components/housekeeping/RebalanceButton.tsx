'use client'

/**
 * Phase 30 — manager auto-allocate button.
 *
 * Pattern matches `TaskClaimButton.tsx` (Phase 27.A — useTransition + ConfirmModal + AlertModal).
 * Calls `runAutoAllocation()` server action → shows summary in alert modal.
 *
 * Disabled when no unassigned tasks to allocate (prevents no-op clicks).
 */
import { useState, useTransition } from 'react'
import { runAutoAllocation } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

interface RebalanceButtonProps {
  unassignedCount: number
  availableHousekeepers: number
}

export function RebalanceButton({ unassignedCount, availableHousekeepers }: RebalanceButtonProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [successSummary, setSuccessSummary] = useState<{
    assigned: number
    skipped: number
    warnings: string[]
  } | null>(null)

  const disabled = unassignedCount === 0 || isPending || availableHousekeepers === 0

  function handleClick() {
    setConfirmOpen(true)
  }

  function handleConfirm() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await runAutoAllocation()
      if (result.ok && result.data) {
        setSuccessSummary({
          assigned: result.data.assignedCount,
          skipped: result.data.skippedCount,
          warnings: result.data.warnings,
        })
      } else if (!result.ok) {
        setAlertMessage(result.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={t('manager.housekeepingPage.rebalanceHint') as string}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-md text-caption uppercase tracking-wider hover:bg-secondary-container hover:text-secondary transition-colors duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="auto_awesome" size={18} />
        {t('manager.housekeepingPage.rebalance')}
        {unassignedCount > 0 ? ` (${unassignedCount})` : ''}
      </button>

      {confirmOpen && (
        <ConfirmModal
          open
          body={t('manager.housekeepingPage.confirmRebalance', { count: unassignedCount }) as string}
          okLabel={t('manager.housekeepingPage.rebalance')}
          cancelLabel={t('common.cancel') ?? 'ยกเลิก'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}

      {successSummary && (
        <AlertModal
          open
          onClose={() => setSuccessSummary(null)}
          title={t('manager.housekeepingPage.autoAllocateComplete') as string}
          body={
            `${t('manager.housekeepingPage.autoAllocateResult', { assigned: successSummary.assigned, skipped: successSummary.skipped })}` +
            (successSummary.warnings.length > 0 ? `\n\n⚠️ ${successSummary.warnings.join('\n')}` : '')
          }
        />
      )}

      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}