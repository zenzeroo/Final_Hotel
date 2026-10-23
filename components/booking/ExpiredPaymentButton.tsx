'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retryExpiredBookingAction } from '@/app/actions/payment'
import { Modal } from '@/components/ui/Modal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'

const BUTTON_CLASS = {
  block:
    'w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors border border-error text-error hover:bg-error/10',
  inline:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-label-md uppercase tracking-wider transition-colors border border-error text-error hover:bg-error/10',
}

/**
 * Phase 58 — takes the Pay button's place once a booking's payment window
 * ran out. Opens a popup: choose another room (room list with the same
 * dates) or, for a payment-deadline expiry, re-open this booking and go
 * straight to Stripe (retryExpiredBookingAction). If the room was re-sold
 * meanwhile the guest is told so and sent to the room list.
 */
export function ExpiredPaymentButton({
  bookingId,
  roomsHref,
  retryable,
  variant = 'block',
}: {
  bookingId: string
  /** /rooms with the booking's dates (or without, when they have passed). */
  roomsHref: string
  /** Only payment-deadline expiries can be re-opened. */
  retryable: boolean
  variant?: 'block' | 'inline'
}) {
  const t = useT()
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const retry = () => {
    if (isPending) return
    startTransition(async () => {
      const result = await retryExpiredBookingAction({ bookingId })
      if (result.ok) {
        window.location.assign(result.url)
        return
      }
      toast.error(result.error)
      setOpen(false)
      if (result.reason !== 'error') router.push(roomsHref)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
        className={BUTTON_CLASS[variant]}
      >
        <MaterialIcon name="timer_off" size={variant === 'block' ? 18 : 16} />
        {t('bookings.paymentExpiredButton')}
      </button>
      <Modal
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title={t('bookings.paymentExpiredTitle')}
        body={retryable ? t('bookings.paymentExpiredBody') : t('bookings.paymentExpiredBodyNoRetry')}
        variant="confirm"
        actions={[
          {
            label: t('bookings.chooseOtherRoom'),
            onClick: () => router.push(roomsHref),
            variant: 'ghost',
            disabled: isPending,
          },
          ...(retryable
            ? [
                {
                  label: isPending ? '…' : t('bookings.retryBooking'),
                  onClick: retry,
                  variant: 'primary' as const,
                  disabled: isPending,
                },
              ]
            : []),
        ]}
      />
    </>
  )
}
