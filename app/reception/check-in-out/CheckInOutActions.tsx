'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { formatDate } from '@/lib/dates'
import type { NotReadyReason } from '@/lib/room-status'

export interface CheckInUnit {
  id: string
  unit_label: string
  floor: number
  /** Shown for alternative rooms so reception sees it is a different type. */
  roomTypeName?: string | null
}

interface CheckInOutActionsProps {
  bookingId: string
  action: 'check_in' | 'check_out'
  label: string
  /**
   * Check-in only. Ready rooms of the booked room type — the default
   * (lib/room-status.ts splitCheckInUnits). Ignored for check-out.
   */
  bookedUnits?: CheckInUnit[]
  /**
   * Check-in only. Every other ready room, offered when the booked room has
   * a problem ("ห้องมีปัญหา — เลือกห้องอื่น") or isn't ready.
   */
  otherUnits?: CheckInUnit[]
  /** Check-in only. Booked-type rooms that aren't ready, each with why (getRoomNotReadyReasons). */
  bookedNotReady?: { unit_label: string; status: string; reason?: NotReadyReason }[]
}

const selectClass =
  'max-w-full px-2 py-1 rounded-full bg-surface-container-low border border-outline-variant text-caption text-on-surface focus:outline-none focus:border-secondary'
const linkButtonClass = 'text-caption text-primary underline-offset-2 hover:underline disabled:opacity-60'

export function CheckInOutActions({
  bookingId,
  action,
  label,
  bookedUnits = [],
  otherUnits = [],
  bookedNotReady = [],
}: CheckInOutActionsProps) {
  const t = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isCheckIn = action === 'check_in'
  // Default: the room the guest booked. Alternatives only on request, or
  // straight away when the booked room isn't ready.
  const [useOther, setUseOther] = useState(bookedUnits.length === 0)
  const units = useOther ? otherUnits : bookedUnits
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    (bookedUnits.length > 0 ? bookedUnits : otherUnits)[0]?.id ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  // No ready room anywhere → say so instead of failing with "select a room first".
  const noRoomReady = isCheckIn && bookedUnits.length === 0 && otherUnits.length === 0

  function switchList(other: boolean) {
    setUseOther(other)
    setSelectedUnitId((other ? otherUnits : bookedUnits)[0]?.id ?? '')
    setError(null)
  }

  const unitLabel = (u: CheckInUnit) =>
    useOther && u.roomTypeName
      ? t('reception.checkInOutPage.unitTypeFloor', { unit: u.unit_label, type: u.roomTypeName, floor: u.floor })
      : t('reception.checkInOutPage.unitFloor', { unit: u.unit_label, floor: u.floor })

  const handleClick = async () => {
    setError(null)
    startTransition(async () => {
      // Phase 20 #25 — moved to server actions so the email fire-and-forget
      // (checkout_thank_you on check-out) runs server-side where it has
      // access to Resend + the admin client. Client-side supabase updates
      // can't reach Resend's API key.
      const roomUnitId = isCheckIn ? selectedUnitId : null

      if (isCheckIn && !roomUnitId) {
        setError(t('reception.checkInOutPage.selectRoomFirst'))
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isCheckIn && units.length === 1 && !useOther && (
          // The booked room — a fixed label, nothing to choose.
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-caption font-semibold">
            <MaterialIcon name="meeting_room" size={14} />
            {unitLabel(units[0])}
          </span>
        )}
        {isCheckIn && (units.length > 1 || (useOther && units.length > 0)) && (
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            disabled={isPending}
            className={selectClass}
            aria-label={t('reception.checkInOutPage.selectRoom')}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {unitLabel(u)}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending || noRoomReady || (isCheckIn && units.length === 0)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-secondary text-caption font-semibold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <span className="inline-block w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          ) : (
            <MaterialIcon name={isCheckIn ? 'login' : 'logout'} size={14} />
          )}
          {label}
        </button>
      </div>

      {isCheckIn && !noRoomReady && (
        <>
          {bookedUnits.length === 0 && (
            <div className="text-caption text-error max-w-64 text-right">
              <p>{t('reception.checkInOutPage.bookedRoomNotReady')}</p>
              {bookedNotReady.length > 0 && (
                <ul className="mt-0.5">
                  {bookedNotReady.map((u) => (
                    <li key={u.unit_label}>
                      <span className="font-semibold">{u.unit_label}</span> ·{' '}
                      {reasonText(u.reason ?? { kind: 'status', status: u.status }, t)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {bookedUnits.length > 0 && !useOther && otherUnits.length > 0 && (
            <button type="button" onClick={() => switchList(true)} disabled={isPending} className={linkButtonClass}>
              {t('reception.checkInOutPage.roomProblem')}
            </button>
          )}
          {bookedUnits.length > 0 && useOther && (
            <button type="button" onClick={() => switchList(false)} disabled={isPending} className={linkButtonClass}>
              {t('reception.checkInOutPage.useBookedRoom')}
            </button>
          )}
        </>
      )}
      {noRoomReady && (
        <Link
          href="/reception/rooms"
          className="text-caption text-error max-w-56 text-right underline-offset-2 hover:underline"
        >
          {t('reception.checkInOutPage.noRoomReady')}
        </Link>
      )}
      {error && (
        <p className="text-caption text-error max-w-48 text-right">{error}</p>
      )}
    </div>
  )
}

/** One readable line for why a room can't take the guest yet. */
function reasonText(r: NotReadyReason, t: ReturnType<typeof useT>): string {
  switch (r.kind) {
    case 'guest':
      return r.until
        ? t('reception.checkInOutPage.reasonGuestUntil', { date: formatDate(r.until) })
        : t('reception.checkInOutPage.reasonGuest')
    case 'waiting_cleaning':
      return r.by
        ? t('reception.checkInOutPage.reasonWaitingCleaningBy', { name: r.by })
        : t('reception.checkInOutPage.reasonWaitingCleaning')
    case 'cleaning':
      return r.by ? t('reception.checkInOutPage.reasonCleaningBy', { name: r.by }) : t('reception.checkInOutPage.reasonCleaning')
    case 'inspection':
      return t('reception.checkInOutPage.reasonInspection')
    case 'repair':
      return r.detail ? t('reception.checkInOutPage.reasonRepairWith', { detail: r.detail }) : t('reception.checkInOutPage.reasonRepair')
    case 'damage':
      return t('reception.checkInOutPage.reasonDamage', { detail: r.detail })
    case 'status':
      return t(`staff.status.${r.status}`)
  }
}
