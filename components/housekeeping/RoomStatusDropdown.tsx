'use client'

import { useState, useTransition } from 'react'
import { updateRoomStatus } from '@/app/actions/housekeeping'
import { AlertModal } from '@/components/ui/AlertModal'

const EDITABLE_STATUSES = ['waiting_cleaning', 'cleaning', 'ready', 'available'] as const
type EditableStatus = (typeof EDITABLE_STATUSES)[number]

const STATUS_LABELS: Record<EditableStatus, string> = {
  waiting_cleaning: 'รอทำความสะอาด',
  cleaning: 'กำลังทำความสะอาด',
  ready: 'พร้อมขาย',
  available: 'ว่าง',
}

export function RoomStatusDropdown({
  unitId,
  currentStatus,
}: {
  unitId: string
  currentStatus: EditableStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as EditableStatus
    if (newStatus === currentStatus) return
    startTransition(async () => {
      const result = await updateRoomStatus(unitId, newStatus)
      if (!result.ok) {
        setAlertMessage(result.error)
        e.target.value = currentStatus
      }
    })
  }

  return (
    <>
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
      >
        {EDITABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}
