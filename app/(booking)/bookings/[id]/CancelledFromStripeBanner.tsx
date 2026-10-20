'use client'

/**
 * Phase 52 — Banner shown when the customer returns from Stripe's
 * hosted checkout page via the `?cancelled=1` redirect.
 *
 * Replaces the previous static text-only banner with an actionable one:
 *   - "ยังไม่ได้ชำระเงิน" (warning-styled, with icon)
 *   - "ชำระเงิน" button → re-opens Stripe Checkout (via the same
 *     `createCheckoutSessionAction` used by the main pay button)
 *   - "ยกเลิกรายการ" button → calls `cancelUnpaidBookingAction` then
 *     refreshes the page (the page renders the cancelled state from DB)
 *
 * Renders only when `paymentStatus === 'unpaid' AND status IN
 * ('confirmed', 'temp_pending')`. For paid/cancelled/expired bookings
 * the parent page skips this banner.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { createCheckoutSessionAction } from '@/app/actions/payment'
import { cancelUnpaidBookingAction } from '@/app/actions/booking-unpaid-cancel'
import { useLeaveGuard } from '@/components/booking/LeaveGuardProvider'

interface CancelledFromStripeBannerProps {
  bookingId: string
}

export function CancelledFromStripeBanner({ bookingId }: CancelledFromStripeBannerProps) {
  const t = useT()
  const router = useRouter()
  const { allowNavigation } = useLeaveGuard()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handlePay = () => {
    setError(null)
    startTransition(async () => {
      const result = await createCheckoutSessionAction({ bookingId })
      if (!result.ok) {
        setError(result.error || 'ไม่สามารถเปิดหน้าชำระเงินได้')
        return
      }
      if (!result.data?.url) {
        setError('ไม่สามารถเปิดหน้าชำระเงินได้')
        return
      }
      // See ConfirmationActions.handlePay — the Stripe redirect is the
      // intentional payment flow, not an accidental page leave.
      allowNavigation()
      window.location.assign(result.data.url)
    })
  }

  const handleCancel = () => {
    setError(null)
    startTransition(async () => {
      const result = await cancelUnpaidBookingAction({ bookingId })
      if (!result.ok) {
        setError(result.error || 'ไม่สามารถยกเลิกรายการได้')
        return
      }
      // Phase 52 follow-up — if the server reconciled the booking as
      // paid (Stripe race), the banner should disappear on refresh
      // (the page now shows the paid state). Just refresh in place.
      router.refresh()
    })
  }

  return (
    <div className="mb-6 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 flex-1">
        <MaterialIcon name="info" size={20} className="text-warning shrink-0" />
        <p className="text-body-md text-on-surface font-medium">
          {t('bookings.unpaidReturnBanner')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handlePay}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
        >
          <MaterialIcon name="credit_card" size={16} />
          {t('bookings.unpaidReturnPay')}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-error text-error rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-error/10 transition-colors disabled:opacity-60"
        >
          <MaterialIcon name="cancel" size={16} />
          {t('bookings.unpaidReturnCancel')}
        </button>
      </div>
      {error && (
        <p className="font-caption text-caption text-error sm:basis-full">{error}</p>
      )}
    </div>
  )
}
