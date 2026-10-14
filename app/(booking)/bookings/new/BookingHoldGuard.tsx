'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { useT } from '@/lib/i18n/useT'
import {
  touchBookingHoldAction,
  releaseBookingHoldAction,
} from '@/app/actions/booking'

interface BookingHoldGuardProps {
  /** Booking ID whose hold we're guarding. */
  bookingId: string
  /**
   * Path to send the user when they confirm "ออกจากหน้านี้" from
   * the leave-guard. Usually the room page or /bookings history.
   */
  leaveHref: string
  /**
   * When true, the guard is fully disabled — used after a successful
   * booking submit so the form's redirect to /bookings/[id] is not
   * blocked. The parent component flips this via a callback.
   */
  disabled?: boolean
}

const HEARTBEAT_INTERVAL_MS = 30_000
const IDLE_THRESHOLD_MS = 5 * 60_000 // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 60_000 // 1 minute poll
const IDLE_RELEASE_COUNTDOWN_S = 60

type DialogState =
  | { kind: 'none' }
  | { kind: 'leave'; pendingHref: string | null }
  | { kind: 'idle'; countdown: number }
  | { kind: 'lapsed' }

/**
 * Phase 50 — leave-guard for /bookings/new?bookingId=...
 *
 * Three concerns:
 *   1. Heartbeat — every 30s, call `touchBookingHoldAction(bookingId)`
 *      to extend the rolling 3-min lease. Background-tab throttling
 *      means we get ~1 ping/min when hidden, which is still > the
 *      3-min lease — safe.
 *   2. Leave-guard — back button + in-app <a>/Link clicks trigger a
 *      "คุณต้องการกรอกข้อมูลเพื่อจองต่อไหม?" dialog. "กรอกข้อมูลต่อ"
 *      closes the dialog and re-pushes the sentinel (back stays put).
 *      "ออกจากหน้านี้" calls `releaseBookingHoldAction` then completes
 *      the original navigation.
 *   3. Idle-guard — 5 min of no interaction (keydown/click/input) shows
 *      a 60s countdown modal. If the user doesn't act, we release
 *      the hold and bounce them to `leaveHref`.
 *
 * Browser `beforeunload` always shows the native dialog (un-styled)
 * for refresh/tab close/external nav — that's the expected behavior;
 * we just need to add the listener.
 */
export function BookingHoldGuard({ bookingId, leaveHref, disabled }: BookingHoldGuardProps) {
  const router = useRouter()
  const t = useT()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })
  const disabledRef = useRef(disabled)
  // Sync the ref outside of render so event handlers always see the
  // latest prop value. The lint rule against writing to refs in render
  // exists because doing so creates a subtle ordering hazard between
  // the ref's read site (event handlers) and the next render — we
  // sidestep that by writing in useEffect, which runs after render
  // commits but before any subsequent event.
  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])
  const sentinelPushed = useRef(false)
  // Initialized to 0 — set to Date.now() in the effect below so the
  // initial value is pure (per React's strict rules: no side effects
  // during render).
  const lastInteraction = useRef(0)
  useEffect(() => {
    lastInteraction.current = Date.now()
  }, [])

  // ──────────────────────────────────────────────────────────────────
  // 1. Heartbeat — extend lease every 30s.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return
    let cancelled = false

    async function tick() {
      if (cancelled || disabledRef.current) return
      const result = await touchBookingHoldAction(bookingId)
      if (cancelled) return
      if (!result.ok) {
        // Lease lapsed (or not owner, etc). Show the lapsed dialog so
        // the user knows to re-pick the room.
        setDialog({ kind: 'lapsed' })
      }
    }

    // Run an initial tick immediately, then every 30s.
    tick()
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [bookingId, disabled])

  // ──────────────────────────────────────────────────────────────────
  // 2. Leave-guard — back button + in-app link capture.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return
    if (!sentinelPushed.current) {
      // Push one sentinel history entry so the next "back" lands on
      // us instead of the previous page. React Strict Mode double-
      // mount in dev is handled by the ref guard.
      window.history.pushState({ holdGuard: true }, '')
      sentinelPushed.current = true
    }

    function onPopState(_e: PopStateEvent) {
      if (disabledRef.current) return
      // The user pressed Back. Re-push the sentinel so they stay
      // unless they confirm. We do NOT call history.back() yet —
      // wait for them to choose "ออกจากหน้านี้".
      window.history.pushState({ holdGuard: true }, '')
      setDialog({ kind: 'leave', pendingHref: null })
    }

    function onClickCapture(e: MouseEvent) {
      if (disabledRef.current) return
      // Modified clicks (Cmd/Ctrl/Shift/Alt) → let the browser open in
      // a new tab without prompting.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      // Right-click / middle-click → ignore.
      if (e.button !== 0) return
      const a = (e.target as HTMLElement | null)?.closest('a[href]') as
        | HTMLAnchorElement
        | null
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      // Same-page links (hash anchors, current pathname) → ignore.
      if (href.startsWith('#')) return
      try {
        const url = new URL(href, window.location.href)
        if (url.origin !== window.location.origin) return // external
        if (url.pathname === window.location.pathname) return // same page
      } catch {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      setDialog({ kind: 'leave', pendingHref: href })
    }

    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClickCapture, true)

    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [disabled])

  // ──────────────────────────────────────────────────────────────────
  // 3. beforeunload — browser native prompt for refresh/tab close.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (disabledRef.current) return
      // Browser shows its own generic "Leave site?" dialog; we can't
      // customize the message. Just set returnValue to trigger it.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [disabled])

  // ──────────────────────────────────────────────────────────────────
  // 4. Idle guard — 5 min no interaction → 60s release countdown.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return
    function onInteraction() {
      lastInteraction.current = Date.now()
    }
    const events: (keyof DocumentEventMap)[] = ['keydown', 'click', 'input']
    events.forEach((e) => document.addEventListener(e, onInteraction, true))

    const id = setInterval(() => {
      if (disabledRef.current) return
      if (Date.now() - lastInteraction.current < IDLE_THRESHOLD_MS) return
      setDialog({ kind: 'idle', countdown: IDLE_RELEASE_COUNTDOWN_S })
    }, IDLE_CHECK_INTERVAL_MS)

    return () => {
      events.forEach((e) => document.removeEventListener(e, onInteraction, true))
      clearInterval(id)
    }
  }, [disabled])

  // ──────────────────────────────────────────────────────────────────
  // Idle countdown ticker — when dialog is 'idle', decrement once
  // per second. At 0, release and redirect.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dialog.kind !== 'idle') return
    if (dialog.countdown <= 0) {
      // Auto-release
      releaseBookingHoldAction(bookingId).finally(() => {
        router.push(leaveHref)
      })
      return
    }
    const id = setTimeout(() => {
      setDialog((d) => (d.kind === 'idle' ? { kind: 'idle', countdown: d.countdown - 1 } : d))
    }, 1000)
    return () => clearTimeout(id)
  }, [dialog, bookingId, leaveHref, router])

  // ──────────────────────────────────────────────────────────────────
  // Dialog action handlers.
  // ──────────────────────────────────────────────────────────────────
  const handleStay = useCallback(() => {
    setDialog({ kind: 'none' })
  }, [])

  const handleLeave = useCallback(async () => {
    const target = dialog.kind === 'leave' ? dialog.pendingHref : null
    setDialog({ kind: 'none' })
    // Release the hold server-side so the room becomes available
    // immediately. The action is idempotent + owner-checked.
    await releaseBookingHoldAction(bookingId)
    // Navigate. If the user came from a link, honour that target;
    // otherwise fall back to leaveHref.
    if (target) {
      window.location.assign(target)
    } else {
      router.push(leaveHref)
    }
  }, [dialog, bookingId, leaveHref, router])

  const handleLapsedClose = useCallback(() => {
    setDialog({ kind: 'none' })
    router.push(leaveHref)
  }, [leaveHref, router])

  // ──────────────────────────────────────────────────────────────────
  // Render — dialogs only.
  // ──────────────────────────────────────────────────────────────────
  return (
    <>
      {dialog.kind === 'leave' && (
        <Modal
          open
          onClose={handleStay}
          title={t('bookings.leaveGuardTitle')}
          body={t('bookings.leaveGuardBody')}
          actions={[
            {
              label: t('bookings.leaveGuardStay'),
              onClick: handleStay,
              variant: 'ghost',
            },
            {
              label: t('bookings.leaveGuardLeave'),
              onClick: handleLeave,
              variant: 'danger',
            },
          ]}
        />
      )}
      {dialog.kind === 'idle' && (
        <Modal
          open
          onClose={handleStay}
          title={t('bookings.idleGuardTitle')}
          body={
            <>
              <p>{t('bookings.idleGuardBody')}</p>
              <p className="mt-3 text-center text-body-md font-semibold text-error">
                {t('bookings.idleGuardCountdown', { seconds: dialog.countdown })}
              </p>
            </>
          }
          actions={[
            {
              label: t('bookings.leaveGuardStay'),
              onClick: handleStay,
              variant: 'primary',
            },
            {
              label: t('bookings.leaveGuardLeave'),
              onClick: handleLeave,
              variant: 'danger',
            },
          ]}
        />
      )}
      {dialog.kind === 'lapsed' && (
        <Modal
          open
          onClose={handleLapsedClose}
          title={t('bookings.holdLapsedTitle')}
          body={t('bookings.holdLapsedBody')}
          actions={[
            {
              label: t('bookings.holdLapsedOk'),
              onClick: handleLapsedClose,
              variant: 'primary',
            },
          ]}
        />
      )}
    </>
  )
}
