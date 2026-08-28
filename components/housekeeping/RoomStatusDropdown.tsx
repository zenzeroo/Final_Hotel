'use client'

import { useTransition } from 'react'
import { updateRoomStatus } from '@/app/actions/housekeeping'

export function RoomStatusDropdown({
  unitId,
  currentStatus,
}: {
  unitId: string
  currentStatus: 'cleaning' | 'available'
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as 'cleaning' | 'available'
    if (newStatus === currentStatus) return
    startTransition(async () => {
      const result = await updateRoomStatus(unitId, newStatus)
      if (!result.ok) {
        alert(result.error)
        e.target.value = currentStatus
      }
    })
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
    >
      <option value="cleaning">กำลังทำความสะอาด</option>
      <option value="available">ว่าง</option>
    </select>
  )
}