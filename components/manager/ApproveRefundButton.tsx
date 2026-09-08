'use client'

import { useTransition } from 'react'
import { approveRefundAction } from '@/app/actions/manager'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface ApproveRefundButtonProps {
  refundId: string
}

export function ApproveRefundButton({ refundId }: ApproveRefundButtonProps) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => startTransition(async () => {
        await approveRefundAction(fd)
      })}
    >
      <input type="hidden" name="refundId" value={refundId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-on-primary text-caption font-semibold hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50"
      >
        <MaterialIcon name="check" size={16} />
        {pending ? '...' : 'อนุมัติ'}
      </button>
    </form>
  )
}
