'use client'

import { useState, useTransition } from 'react'
import type { RoomUnitStatus } from '@/lib/data/types'
import { closeRoomAction, reopenRoomAction } from '@/app/actions/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { isClosedStatus } from './roomStatusBuckets'
import { useT } from '@/lib/i18n/useT'

interface CloseRoomButtonProps {
  unitId: string
  status: RoomUnitStatus
}

export function CloseRoomButton({ unitId, status }: CloseRoomButtonProps) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const toast = useToast()

  // A room with a guest in it can't be closed — the server refuses too.
  if (status === 'occupied') return null

  const isClosed = isClosedStatus(status)
  const label = isClosed ? t('manager.roomsTable.reopen') : t('manager.roomsTable.close')
  const icon = isClosed ? 'check_circle' : 'build'
  const tone = isClosed
    ? 'text-primary hover:text-primary'
    : 'text-error hover:text-error'
  const action = isClosed ? reopenRoomAction : closeRoomAction

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    const msg = isClosed
      ? t('manager.roomsTable.confirmReopen')
      : t('manager.roomsTable.confirmClose')
    setConfirmMessage(msg)
  }

  async function handleConfirm() {
    const msg = confirmMessage
    setConfirmMessage(null)
    if (!msg) return
    const fd = new FormData()
    fd.set('unitId', unitId)
    startTransition(async () => {
      const result = await action(fd)
      if (!result.ok) {
        toast.error(result.error, { title: isClosed ? t('manager.roomsTable.reopenFailed') : t('manager.roomsTable.closeFailed') })
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-caption font-semibold transition-colors disabled:opacity-50 hover:bg-primary-fixed hover:text-primary ${tone}`}
        title={label}
      >
        <MaterialIcon name={icon} size={14} />
        {pending ? '...' : label}
      </button>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
          variant={isClosed ? 'default' : 'danger'}
          okLabel={isClosed ? t('manager.roomsTable.reopenOk') : t('manager.roomsTable.close')}
        />
      )}
    </>
  )
}
