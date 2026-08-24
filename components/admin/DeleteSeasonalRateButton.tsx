'use client'

import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { deleteSeasonalRateAction } from '@/app/actions/admin/rates'

interface DeleteSeasonalRateButtonProps {
  id: string
  label: string
}

export function DeleteSeasonalRateButton({ id, label }: DeleteSeasonalRateButtonProps) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => {
        if (!confirm(`ลบช่วงราคา "${label}"? การกระทำนี้ไม่สามารถยกเลิกได้`)) return
        startTransition(async () => {
          await deleteSeasonalRateAction(fd)
        })
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title={`ลบ ${label}`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete" size={18} />
      </button>
    </form>
  )
}
