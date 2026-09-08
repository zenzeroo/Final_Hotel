'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { pollBookingPaymentStatusAction } from '@/app/actions/payment'

type ModalView = 'success' | 'processing' | 'timeout'

/**
 * Stripe Checkout success pop-up. Mounts when user lands on
 * /bookings/[id]?session_id=cs_… after a Stripe payment.
 *
 * Clones the CheckEmailModal pattern from components/auth/register/:
 *   - Escape key closes
 *   - Backdrop click closes
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - Inner card stopPropagation prevents click-through
 *
 * Three view states (Phase 27 — polling fix for webhook race condition):
 *   - "processing" (initial, unless webhook already flipped DB): spinner +
 *     poll server action every 2s up to 15 attempts (30s). Switches to
 *     "success" when poll returns paid/refunded/partial_refund.
 *   - "timeout" (after 30s of unpaid responses): warning + Retry button
 *     that restarts the polling cycle.
 *   - "success": verified icon + 2 buttons (View booking detail / Go to home).
 *
 * Two action buttons (in success view):
 *   - "ดูรายละเอียดการจอง" → dismiss modal (user is already on the
 *     booking detail page)
 *   - "ไปหน้าหลัก" → router.push('/')
 */
export function PaymentSuccessModal({
  bookingId,
  initialPaymentStatus,
}: {
  bookingId: string
  initialPaymentStatus: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [viewState, setViewState] = useState<ModalView>(
    initialPaymentStatus === 'paid' ? 'success' : 'processing',
  )
  const t = useT()
  const titleId = 'payment-success-modal-title'

  // Escape key listener — only attaches when modal is open
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  // Polling effect — runs whenever the modal is in 'processing' state.
  // Re-runs when viewState changes (Retry button resets to 'processing').
  useEffect(() => {
    if (viewState !== 'processing') return

    const MAX_ATTEMPTS = 15 // 15 × 2s = 30s timeout
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      const result = await pollBookingPaymentStatusAction(bookingId)
      if (!result.ok) {
        // Server error — keep polling until max attempts
        if (attempts >= MAX_ATTEMPTS) setViewState('timeout')
        return
      }
      const status = result.data!.paymentStatus
      if (
        status === 'paid' ||
        status === 'refunded' ||
        status === 'partial_refund'
      ) {
        setViewState('success')
      } else if (attempts >= MAX_ATTEMPTS) {
        setViewState('timeout')
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [viewState, bookingId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {viewState === 'success' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-primary">
              <MaterialIcon name="verified" size={32} />
            </div>
            <h2
              id={titleId}
              className="font-display text-2xl font-bold text-primary"
            >
              {t('paymentSuccess.title')}
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {t('paymentSuccess.body')}
            </p>
            <div className="w-full flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                onClick={() => router.push('/bookings')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 border border-primary text-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
              >
                <MaterialIcon name="history" size={18} />
                {t('paymentSuccess.viewHistory')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
              >
                <MaterialIcon name="home" size={18} />
                {t('paymentSuccess.goHome')}
              </button>
            </div>
          </div>
        )}

        {viewState === 'processing' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary-container text-secondary">
              <span className="inline-block w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2
              id={titleId}
              className="font-display text-2xl font-bold text-primary"
            >
              {t('paymentSuccess.processingTitle')}
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {t('paymentSuccess.processingBody')}
            </p>
          </div>
        )}

        {viewState === 'timeout' && (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 text-warning">
              <MaterialIcon name="warning" size={32} />
            </div>
            <h2
              id={titleId}
              className="font-display text-2xl font-bold text-primary"
            >
              {t('paymentSuccess.timeoutTitle')}
            </h2>
            <p className="text-body-md text-on-surface-variant">
              {t('paymentSuccess.timeoutBody')}
            </p>
            <button
              type="button"
              onClick={() => setViewState('processing')}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
            >
              <MaterialIcon name="refresh" size={18} />
              {t('paymentSuccess.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
