'use client'

/**
 * Phase 40 — Client-side trigger for `acquireBookingHoldAction`.
 *
 * Phase 40 fix: Next.js only allows `cookies().set()` inside a Server
 * Action invocation FROM a Client Component (or form action / Route
 * Handler / middleware). Calling the action directly from the Server
 * Component render of /bookings/new threw "Cookies can only be modified
 * in a Server Action or Route Handler" at runtime.
 *
 * This Client Component fires the action once on mount via `useEffect`.
 * No visible UI — rendered as a sibling of <BookingForm> on the page.
 * Matches the existing pattern used by `<LanguageToggle>` →
 * `setLocaleAction` (app/actions/locale.ts:36, where cookies().set()
 * works because the form action invokes the action from the Client
 * Component boundary).
 *
 * Race window: ~50–200ms between page render and hold acquisition.
 * Acceptable because `create_booking` RPC counts holds + bookings in
 * the capacity check under FOR UPDATE — DB-level safety net is
 * authoritative.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { acquireBookingHoldAction } from '@/app/actions/booking-holds'

interface BookingHoldInitProps {
  roomTypeId: string
  checkIn: string
  checkOut: string
  roomSlug: string
}

export function BookingHoldInit({
  roomTypeId,
  checkIn,
  checkOut,
  roomSlug,
}: BookingHoldInitProps) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    void acquireBookingHoldAction({ roomTypeId, checkIn, checkOut }).then(
      (result) => {
        if (cancelled) return
        if (!result.ok) {
          // Pre-check failed — slot is held by another user or pool
          // exhausted. Redirect back to the room page with the
          // error banner (app/rooms/[id]/page.tsx reads ?error=held).
          router.replace(`/rooms/${roomSlug}?error=held`)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [roomTypeId, checkIn, checkOut, roomSlug, router])

  return null
}
