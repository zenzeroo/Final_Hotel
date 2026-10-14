'use client'

/**
 * Phase 52 follow-up (server→client function prop fix) — single
 * source of truth for the leave-guard state on /bookings/[id].
 *
 * Replaces the previous `BookingUnpaidGuard` (deleted) and absorbs:
 *   - the leave dialog state + handlers
 *   - the popstate + click-capture + beforeunload listeners
 *   - the deadline trip to the leave-guard (the visible "กรุณาชำระเงิน
 *     ภายใน HH:mm" strip is rendered server-side by the page itself
 *     for hydration safety)
 *
 * Exposes a `useLeaveGuard()` hook (via React context) returning
 * `{ requestLeave(href: string | null) => void }`. Any client
 * component inside the provider can call this to open the dialog
 * (e.g. `LeaveGuardBackButton`, the cancel button in
 * `ConfirmationActions`, the `CancelledFromStripeBanner` cancel
 * button). No more custom events on `window` — the hook is the
 * single shared API.
 *
 * The page passes only serializable props (`bookingId`, `enabled`,
 * `backHref`, `children`) — no function props across the RSC
 * boundary.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { useT } from '@/lib/i18n/useT'
import { cancelUnpaidBookingAction } from '@/app/actions/booking-unpaid-cancel'

export interface LeaveGuardContextValue {
  /**
   * Open the leave dialog. Pass the href the user is trying to leave
   * to (so we can re-navigate there after cancel), or `null` for the
   * browser Back button / programmatic back control.
   */
  requestLeave: (href: string | null) => void
}

const LeaveGuardContext = createContext<LeaveGuardContextValue | null>(null)

export function useLeaveGuard(): LeaveGuardContextValue {
  const ctx = useContext(LeaveGuardContext)
  if (!ctx) {
    throw new Error(
      'useLeaveGuard must be used inside <LeaveGuardProvider>. Wrap the page content with the provider.',
    )
  }
  return ctx
}

interface LeaveGuardProviderProps {
  /** Booking ID whose payment we're guarding. */
  bookingId: string
  /**
   * When `false`, the provider is inert — no listeners are mounted,
   * no dialog can be opened, and `useLeaveGuard().requestLeave()` is a
   * no-op. Use this to disable the guard for paid/cancelled/expired
   * bookings where leaving the page is safe.
   */
  enabled: boolean
  /**
   * Default path to navigate to after a successful cancel when the
   * user didn't originate from a link. Default `/bookings`.
   */
  backHref?: string
  /**
   * Standard `children` — rendered first, then the leave dialog (if
   * open). Any client component inside `children` (e.g. the back
   * button overlay) can call `useLeaveGuard()` to open the dialog.
   */
  children: ReactNode
}

type DialogState =
  | { kind: 'none' }
  | { kind: 'leave'; pendingHref: string | null }

export function LeaveGuardProvider({
  bookingId,
  enabled,
  backHref = '/bookings',
  children,
}: LeaveGuardProviderProps) {
  const router = useRouter()
  const t = useT()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const [isCancelling, setIsCancelling] = useState(false)
  const dialogRef = useRef(dialog)
  useEffect(() => {
    dialogRef.current = dialog
  }, [dialog])

  // ──────────────────────────────────────────────────────────────────
  // The hook API
  // ──────────────────────────────────────────────────────────────────
  const requestLeave = useCallback(
    (href: string | null) => {
      if (!enabled) return
      // For the browser Back button (href=null), re-push the sentinel
      // so the next "back" lands on us (not on the previous page).
      // For in-app link clicks, the click-capture listener already
      // handles re-pushing the sentinel; we just open the dialog.
      if (href === null && typeof window !== 'undefined') {
        window.history.pushState({ leaveGuard: true }, '')
      }
      setDialog({ kind: 'leave', pendingHref: href })
    },
    [enabled],
  )

  // ──────────────────────────────────────────────────────────────────
  // Effect 1 — popstate + click-capture + beforeunload (4 effects in
  // one cleanup cycle for clarity). All disabled when `enabled` is
  // false (so paid/cancelled users can leave freely).
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    const sentinelPushed = { current: false }
    if (!sentinelPushed.current) {
      window.history.pushState({ leaveGuard: true }, '')
      sentinelPushed.current = true
    }

    function onPopState() {
      // Browser back was pressed. Re-push the sentinel so the user
      // stays unless they confirm.
      window.history.pushState({ leaveGuard: true }, '')
      setDialog({ kind: 'leave', pendingHref: null })
    }

    function onClickCapture(e: MouseEvent) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement | null
      const a = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      if (href.startsWith('#')) return
      try {
        const url = new URL(href, window.location.href)
        if (url.origin !== window.location.origin) return
        if (url.pathname === window.location.pathname) return
      } catch {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setDialog({ kind: 'leave', pendingHref: href })
    }

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [enabled])

  // ──────────────────────────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────────────────────────
  const handleStay = useCallback(() => {
    setDialog({ kind: 'none' })
  }, [])

  const handleLeave = useCallback(async () => {
    // Capture the target href at click time, then close the dialog.
    const target = dialogRef.current.kind === 'leave' ? dialogRef.current.pendingHref : null
    setDialog({ kind: 'none' })
    setIsCancelling(true)
    try {
      const result = await cancelUnpaidBookingAction({ bookingId })
      // Phase 52 follow-up — if the server reconciled the booking as
      // paid (Stripe race), refresh the page so the user sees the paid
      // state. Don't redirect to /bookings; they came from /bookings
      // and want to stay on this page.
      if (result.ok && result.data?.status === 'paid') {
        router.refresh()
        return
      }
    } catch (e) {
      console.error('[LeaveGuardProvider] cancelUnpaidBookingAction failed:', e)
    }
    if (target) {
      window.location.assign(target)
    } else {
      router.push(backHref)
    }
  }, [bookingId, backHref, router])

  // Stable no-op for the leave-modal `onClose` while a cancel is in
  // flight. The Modal API requires a non-null function reference; we
  // block user dismissal with `closeOnBackdrop={!isCancelling}` and
  // the `disabled` flags on both actions instead.
  const noOp = useCallback(() => {}, [])

  return (
    <LeaveGuardContext.Provider value={{ requestLeave }}>
      {children}
      {dialog.kind === 'leave' && (
        <Modal
          open
          onClose={isCancelling ? noOp : handleStay}
          closeOnBackdrop={!isCancelling}
          title={t('bookings.unpaidCancelTitle')}
          body={t('bookings.unpaidCancelBody')}
          actions={[
            {
              label: t('bookings.unpaidCancelStay'),
              onClick: handleStay,
              variant: 'ghost',
              disabled: isCancelling,
            },
            {
              label: t('bookings.unpaidCancelConfirm'),
              onClick: handleLeave,
              variant: 'danger',
              disabled: isCancelling,
            },
          ]}
        />
      )}
    </LeaveGuardContext.Provider>
  )
}
