'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useT } from '@/lib/i18n/useT'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Phase 56 — payment deadline + live countdown for a confirmed+unpaid
 * booking. The deadline time renders on the server (pinned to
 * Asia/Bangkok so SSR and client agree); the ticking "time left" only
 * appears after mount to avoid a hydration mismatch. At zero it refreshes
 * once — the server's lazy expiry then shows the booking as expired.
 */
export function PaymentCountdown({
  deadlineIso,
  variant = 'inline',
}: {
  deadlineIso: string
  variant?: 'inline' | 'chip'
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const deadline = new Date(deadlineIso).getTime()
  const [left, setLeft] = useState<number | null>(null)
  const refreshed = useRef(false)

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const remaining = deadline - Date.now()
      setLeft(remaining)
      if (remaining <= 0 && !refreshed.current) {
        refreshed.current = true
        // Re-render from the server a moment after the deadline — the
        // page read runs the lazy expiry, so the booking shows as expired.
        refreshTimer = setTimeout(() => router.refresh(), 1500)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
      clearTimeout(refreshTimer)
    }
  }, [deadline, router])

  const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  }).format(new Date(deadlineIso))

  const expired = left !== null && left <= 0
  const urgent = left !== null && left < 60_000

  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-caption text-caption whitespace-nowrap ${
          expired || urgent ? 'bg-error-container text-on-error-container' : 'bg-warning/15 text-on-surface'
        }`}
        role="timer"
        aria-live="off"
      >
        <MaterialIcon name="schedule" size={14} />
        {expired
          ? t('bookings.paymentTimedOut')
          : left === null
            ? t('bookings.payBy', { time })
            : t('bookings.timeLeft', { time: formatClock(left) })}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2" role="timer" aria-live="off">
      <span>{t('bookings.payBy', { time })}</span>
      {left !== null && (
        <span className={`tabular-nums ${expired || urgent ? 'text-error' : ''}`}>
          · {expired ? t('bookings.paymentTimedOut') : t('bookings.timeLeft', { time: formatClock(left) })}
        </span>
      )}
    </span>
  )
}
