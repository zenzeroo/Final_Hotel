'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { deleteSeasonalRateAction } from '@/app/actions/admin/rates'

interface DeleteSeasonalRateButtonProps {
  id: string
  label: string
}

export function DeleteSeasonalRateButton({ id, label }: DeleteSeasonalRateButtonProps) {
  const [pending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  async function handleConfirm() {
    const fd = new FormData()
    fd.set('id', id)
    setConfirmMessage(null)
    startTransition(async () => {
      await deleteSeasonalRateAction(fd)
    })
  }

  return (
    <>
      <form
        action={(fd) => {
          // Browser fallback — keep form-action safe; CenterModal/ConfirmModal
          // paths take precedence in practice (button triggers modal first).
          void fd
          setConfirmMessage(`ลบช่วงราคา "${label}"? การกระทำนี้ไม่สามารถยกเลิกได้`)
        }}
        className="inline"
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="button"
          onClick={() =>
            setConfirmMessage(
              `ลบช่วงราคา "${label}"? การกระทำนี้ไม่สามารถยกเลิกได้`,
            )
          }
          disabled={pending}
          title={`ลบ ${label}`}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
        >
          <MaterialIcon name="delete" size={18} />
        </button>
      </form>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          variant="danger"
          okLabel="ลบ"
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
