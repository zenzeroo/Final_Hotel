'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'
import { updateRoomStatus } from '@/app/actions/housekeeping'
import { RECEPTION_SETTABLE_STATUSES, roomLockReason, type ReceptionSettableStatus } from '@/lib/room-status'
import { ROOM_STATUS_KEY, bucketWithGuest, roomBucket, type RoomBucket } from '@/components/manager/roomStatusBuckets'
import type { RoomUnitStatus } from '@/lib/data/types'

export interface RoomRow {
  id: string
  unit_label: string
  view_label: string | null
  status: string
  roomTypeName: string | null
  staying: { code: string; name: string } | null
}

export const BUCKET_STYLE: Record<RoomBucket, { badge: string; icon: string }> = {
  available: { badge: 'bg-primary/10 text-primary', icon: 'check_circle' },
  occupied: { badge: 'bg-secondary/20 text-secondary', icon: 'group' },
  cleaning: { badge: 'bg-tertiary/10 text-tertiary', icon: 'cleaning_services' },
  closed: { badge: 'bg-error/10 text-error', icon: 'build' },
}

/** Icon per settable status in the change-status pop-up. */
const OPTION_ICON: Record<ReceptionSettableStatus, string> = {
  waiting_cleaning: 'pending_actions',
  cleaning: 'cleaning_services',
  ready: 'check_circle',
}

/**
 * One row per room: number, type, view, status, and an edit icon that opens
 * a pop-up to move the room through the cleaning flow. Rooms with a guest
 * staying, or closed for maintenance, are locked (the server action refuses
 * them too).
 */
export function RoomStatusList({ rooms }: { rooms: RoomRow[] }) {
  const t = useT()
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<RoomRow | null>(null)
  const [savingStatus, setSavingStatus] = useState<ReceptionSettableStatus | null>(null)

  function change(room: RoomRow, next: ReceptionSettableStatus) {
    setSavingStatus(next)
    startTransition(async () => {
      try {
        const r = await updateRoomStatus(room.id, next)
        if (r.ok) toast.success(t('reception.roomsPage.statusChanged', { room: room.unit_label }))
        else toast.error(r.error)
      } catch {
        toast.error(t('reception.common.updateFailed', { detail: '' }))
      } finally {
        setSavingStatus(null)
        setEditing(null)
        router.refresh()
      }
    })
  }

  const statusLabel = (status: string) => {
    const key = ROOM_STATUS_KEY[status as RoomUnitStatus]
    return key ? t(key) : status
  }

  return (
    <div className="flex flex-col gap-2">
      {rooms.map((room) => {
        const bucket = bucketWithGuest(room.status as RoomUnitStatus, !!room.staying)
        const style = BUCKET_STYLE[bucket]
        const lock = roomLockReason(room.status, !!room.staying)
        return (
          <div
            key={room.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-surface-container-low rounded-xl"
          >
            <span className="font-mono text-body-md font-bold text-on-surface w-14 shrink-0">{room.unit_label}</span>
            <span className="flex-[2] min-w-40 text-body-md text-on-surface truncate">
              {room.roomTypeName ?? t('reception.common.roomFallback')}
              {room.view_label && <span className="text-caption text-on-surface-variant"> · {room.view_label}</span>}
            </span>
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${style.badge}`}>
              <MaterialIcon name={style.icon} size={14} />
              {room.staying && room.status !== 'occupied' ? t('staff.status.occupied') : statusLabel(room.status)}
            </span>
            <div className="ml-auto shrink-0 flex items-center">
              {lock === 'occupied' ? (
                <span className="inline-flex items-center gap-1.5 text-caption text-on-surface-variant max-w-72">
                  <MaterialIcon name="lock" size={14} />
                  {room.staying
                    ? t('reception.roomsPage.lockedGuest', { name: room.staying.name, code: room.staying.code })
                    : t('reception.roomsPage.lockedOccupied')}
                </span>
              ) : lock === 'closed' ? (
                <span className="inline-flex items-center gap-1.5 text-caption text-on-surface-variant">
                  <MaterialIcon name="lock" size={14} />
                  {t('reception.roomsPage.lockedClosed')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(room)}
                  disabled={isPending}
                  aria-label={t('reception.roomsPage.changeStatus', { room: room.unit_label })}
                  title={t('reception.roomsPage.changeStatus', { room: room.unit_label })}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-outline-variant bg-surface-container-lowest text-primary hover:bg-primary-fixed transition-colors disabled:opacity-60"
                >
                  <MaterialIcon name="edit" size={18} />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {editing && (
        <Modal
          open
          onClose={() => !isPending && setEditing(null)}
          title={t('reception.roomsPage.changeStatusTitle', { room: editing.unit_label })}
          showCloseButton
          body={
            <div className="flex flex-col gap-3">
              <p className="text-caption text-on-surface-variant">
                {editing.roomTypeName ?? t('reception.common.roomFallback')} ·{' '}
                <span className="font-semibold">{statusLabel(editing.status)}</span>
              </p>
              {RECEPTION_SETTABLE_STATUSES.map((s) => {
                const current = editing.status === s
                const optionStyle = BUCKET_STYLE[roomBucket(s)]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => change(editing, s)}
                    disabled={current || isPending}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors ${
                      current
                        ? 'border-primary bg-primary/5 cursor-default'
                        : 'border-outline-variant hover:bg-primary-fixed disabled:opacity-60'
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${optionStyle.badge}`}>
                      {savingStatus === s ? (
                        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MaterialIcon name={OPTION_ICON[s]} size={18} />
                      )}
                    </span>
                    <span className="flex-1 text-body-md font-medium text-on-surface">{t(ROOM_STATUS_KEY[s])}</span>
                    {current && (
                      <span className="text-caption text-primary font-semibold">{t('reception.roomsPage.currentStatus')}</span>
                    )}
                  </button>
                )
              })}
            </div>
          }
        />
      )}
    </div>
  )
}
