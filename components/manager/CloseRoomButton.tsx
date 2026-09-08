'use client'

import { useState, useTransition } from 'react'
import { closeRoomAction, reopenRoomAction } from '@/app/actions/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface CloseRoomButtonProps {
  unitId: string
  isClosed: boolean // true = currently maintenance / out_of_order (allow reopen)
}

export function CloseRoomButton({ unitId, isClosed }: CloseRoomButtonProps) {
  const [pending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)
  const label = isClosed ? 'เปิดห้องใหม่' : 'ปิดห้อง'
  const icon = isClosed ? 'check_circle' : 'build'
  const tone = isClosed
    ? 'text-primary hover:text-primary'
    : 'text-error hover:text-error'
  const action = isClosed ? reopenRoomAction : closeRoomAction

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    const msg = isClosed
      ? 'เปิดห้องนี้ให้แขกเข้าพักอีกครั้ง?'
      : 'ปิดห้องนี้ — ห้องจะถูกตั้งเป็น "ซ่อมบำรุง" และไม่สามารถจองได้ ยืนยัน?'
    setConfirmMessage(msg)
  }

  async function handleConfirm() {
    const msg = confirmMessage
    setConfirmMessage(null)
    if (!msg) return
    const fd = new FormData()
    fd.set('unitId', unitId)
    startTransition(async () => {
      await action(fd)
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
          okLabel={isClosed ? 'เปิดห้อง' : 'ปิดห้อง'}
        />
      )}
    </>
  )
}
