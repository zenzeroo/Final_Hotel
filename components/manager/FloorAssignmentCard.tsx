'use client'

import { useState, useTransition } from 'react'
import { setFloorAssignment } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import type { FloorAssignment, HousekeeperOption } from '@/lib/data/types'

interface FloorAssignmentCardProps {
  assignments: FloorAssignment[]
  housekeepers: HousekeeperOption[]
}

export function FloorAssignmentCard({ assignments, housekeepers }: FloorAssignmentCardProps) {
  const [isPending, startTransition] = useTransition()
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [savedFloor, setSavedFloor] = useState<number | null>(null)

  function handleSave(floor: number, value: string) {
    const housekeeperId = value === '' ? null : value
    startTransition(async () => {
      const result = await setFloorAssignment(floor, housekeeperId)
      if (result.ok) {
        setSavedFloor(floor)
        window.setTimeout(() => setSavedFloor(null), 2000)
      } else {
        setAlertMessage(result.error)
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-primary">การมอบหมายชั้น</h3>
      </div>
      <ul className="flex flex-col gap-3">
        {assignments.map((a) => {
          const isSaved = savedFloor === a.floor
          return (
            <li key={a.floor} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-body-md font-semibold text-primary">ชั้น {a.floor}</p>
                <p className="text-caption text-on-surface-variant">
                  {a.label} · {a.totalRooms} ห้อง
                </p>
              </div>
              <select
                defaultValue={a.housekeeperId ?? ''}
                disabled={isPending}
                onChange={(e) => handleSave(a.floor, e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
              >
                <option value="">ยังไม่ได้มอบหมาย</option>
                {housekeepers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.fullName}
                  </option>
                ))}
                {a.housekeeperId && !housekeepers.some((h) => h.id === a.housekeeperId) ? (
                  <option value={a.housekeeperId}>{a.housekeeperName ?? '—'}</option>
                ) : null}
              </select>
              {isSaved ? (
                <MaterialIcon name="check_circle" size={18} className="text-secondary" />
              ) : null}
            </li>
          )
        })}
      </ul>

      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </div>
  )
}