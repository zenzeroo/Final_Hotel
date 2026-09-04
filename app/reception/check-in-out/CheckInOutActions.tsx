'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface AvailableUnit {
  id: string
  unit_label: string
  floor: number
}

interface CheckInOutActionsProps {
  bookingId: string
  action: 'check_in' | 'check_out'
  label: string
  /**
   * Phase 12: list of available room units the staff can assign to a
   * check-in. Required when `action === 'check_in'`; ignored for check-out.
   * Falls back to "no room assigned" if the list is empty (status update only).
   */
  availableUnits?: AvailableUnit[]
}

export function CheckInOutActions({
  bookingId,
  action,
  label,
  availableUnits = [],
}: CheckInOutActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Default to the first available unit so a quick check-in (no select) still
  // assigns a real room when one is available. Empty string = no assignment.
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    availableUnits[0]?.id ?? '',
  )
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    startTransition(async () => {
      // Phase 20 #25 — moved to server actions so the email fire-and-forget
      // (checkout_thank_you on check-out) runs server-side where it has
      // access to Resend + the admin client. Client-side supabase updates
      // can't reach Resend's API key.
      const isCheckIn = action === 'check_in'
      const roomUnitId = isCheckIn ? selectedUnitId : null

      if (isCheckIn && !roomUnitId) {
        setError('กรุณาเลือกห้องก่อนเช็คอิน')
        return
      }

      const { checkInBookingAction, checkOutBookingAction } = await import(
        '@/app/actions/check-in-out'
      )
      const result = isCheckIn
        ? await checkInBookingAction({ bookingId, roomUnitId: roomUnitId! })
        : await checkOutBookingAction({ bookingId })

      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {action === 'check_in' && availableUnits.length > 0 && (
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            disabled={isPending}
            className="px-2 py-1 rounded-full bg-surface-container-low border border-outline-variant text-caption text-on-surface focus:outline-none focus:border-secondary"
            aria-label="เลือกห้อง"
          >
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_label} (ชั้น {u.floor})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-secondary text-caption font-semibold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <span className="inline-block w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          ) : (
            <MaterialIcon name={action === 'check_in' ? 'login' : 'logout'} size={14} />
          )}
          {label}
        </button>
      </div>
      {error && (
        <p className="text-caption text-error max-w-48 text-right">{error}</p>
      )}
    </div>
  )
}
