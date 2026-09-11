import type { RefundRequestStatus } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RefundStatusBadgeProps {
  status: RefundRequestStatus
  /** Pre-formatted amount (use formatTHB on the caller side). */
  amountFormatted: string
  /** Translator for status labels — pass t() from page server component. */
  t: (key: string) => string
}

const STYLES: Record<RefundRequestStatus, { bg: string; text: string; icon: string; labelKey: string }> = {
  pending: {
    bg: 'bg-tertiary/10',
    text: 'text-tertiary',
    icon: 'schedule',
    labelKey: 'bookingDetail.refundStatusPending',
  },
  approved: {
    bg: 'bg-secondary/15',
    text: 'text-secondary',
    icon: 'check_circle',
    labelKey: 'bookingDetail.refundStatusApproved',
  },
  rejected: {
    bg: 'bg-error/10',
    text: 'text-error',
    icon: 'block',
    labelKey: 'bookingDetail.refundStatusRejected',
  },
}

/**
 * Phase 29 — surfaced on `/bookings/[id]` so users see the actual refund
 * state, not just the final `bookings.payment_status`. Reads the latest
 * `refund_requests` row for the booking (RLS-restricted to booking owner
 * via `refund_requests owner read` policy added in 20260919).
 */
export function RefundStatusBadge({ status, amountFormatted, t }: RefundStatusBadgeProps) {
  const s = STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-label-md font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}
    >
      <MaterialIcon name={s.icon} size={16} />
      <span>{t(s.labelKey)}</span>
      <span className="font-mono normal-case">· {amountFormatted}</span>
    </span>
  )
}