'use client'

/**
 * Phase 52 follow-up (RSC fix) — back control for /bookings/[id]
 * when the leave-guard is active.
 *
 * Sits as a fixed-position overlay on top of `TransactionalHeader`'s
 * back Link (z-50 vs z-40). When the leave-guard is enabled, the
 * page renders this component inside the `<LeaveGuardProvider>` so
 * the button is in the DOM and intercepts clicks. When the guard is
 * NOT enabled, the page does NOT render this component, and the
 * header's plain Link is the only back control (default behavior
 * for paid/cancelled/expired bookings).
 *
 * The button uses the same visual treatment as the header's Link
 * (MaterialIcon arrow_back + "ย้อนกลับ" label + hover styles)
 * so the affordance is consistent. The element is a `<button>` (not
 * a Link) because the click opens a dialog, not navigates.
 */

import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useLeaveGuard } from './LeaveGuardProvider'

export function LeaveGuardBackButton() {
  const { requestLeave } = useLeaveGuard()
  return (
    <button
      type="button"
      onClick={() => requestLeave(null)}
      aria-label="ย้อนกลับ"
      // Fixed-position overlay covering the header's back-button area.
      // The header's <Link> below has z-40; this has z-50 so it
      // intercepts the click. When this component is not mounted
      // (guard disabled), the Link below is the only interactive
      // element at this position.
      className="fixed top-0 left-0 z-50 inline-flex items-center gap-2 px-2 py-1 mt-4 ml-(--spacing-margin-mobile) md:ml-(--spacing-margin-desktop) rounded text-body-md text-on-surface bg-surface/80 backdrop-blur-sm hover:bg-primary-fixed hover:text-primary transition-colors"
    >
      <MaterialIcon name="arrow_back" size={20} />
      <span>ย้อนกลับ</span>
    </button>
  )
}
