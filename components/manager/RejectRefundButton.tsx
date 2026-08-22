'use client'

import { useState, useTransition } from 'react'
import { rejectRefundAction } from '@/app/actions/manager'

interface RejectRefundButtonProps {
  refundId: string
}

export function RejectRefundButton({ refundId }: RejectRefundButtonProps) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await rejectRefundAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setConfirming(false)
      setReason('')
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-outline text-caption text-primary hover:bg-surface-container-low"
      >
        Reject
      </button>
    )
  }
  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-2 items-stretch"
    >
      <input type="hidden" name="refundId" value={refundId} />
      <textarea
        name="reason"
        required
        maxLength={500}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="เหตุผลในการปฏิเสธ"
        className="rounded-md border border-outline-variant px-2 py-1 text-caption bg-surface-container-low"
      />
      {error ? (
        <p className="text-[11px] text-error" role="alert">{error}</p>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="px-2 py-1 rounded-md bg-error text-on-error text-caption font-semibold disabled:opacity-50"
        >
          {pending ? '...' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            setReason('')
            setError(null)
          }}
          disabled={pending}
          className="px-2 py-1 rounded-md text-caption text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
