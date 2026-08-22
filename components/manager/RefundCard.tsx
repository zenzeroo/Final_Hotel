import type { RefundRequest } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { ApproveRefundButton } from './ApproveRefundButton'
import { RejectRefundButton } from './RejectRefundButton'

interface RefundCardProps {
  refund: RefundRequest
}

export function RefundCard({ refund }: RefundCardProps) {
  return (
    <article className="bg-surface-container-lowest rounded-lg shadow-level-1 border-l-4 border-error p-6">
      <header className="mb-2">
        <p className="text-body-md font-semibold text-primary">{refund.guestName}</p>
        <p className="text-caption text-on-surface-variant">{refund.bookingCode}</p>
      </header>
      <blockquote className="text-body-md text-on-surface italic border-l-2 border-outline-variant pl-3 my-3">
        &ldquo;{refund.reason}&rdquo;
      </blockquote>
      <p className="text-headline-sm font-display font-bold text-primary mb-4">
        {formatTHB(refund.amount)}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <RejectRefundButton refundId={refund.id} />
        <ApproveRefundButton refundId={refund.id} />
      </div>
    </article>
  )
}
