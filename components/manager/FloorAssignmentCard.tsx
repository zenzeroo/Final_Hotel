'use client'

/**
 * Phase 54 — "assign a whole floor": pick a floor + a housekeeper, press
 * confirm, and every not-yet-started task on that floor goes to them
 * (`assignFloorTasksAction`). The floor's default owner is updated too, and
 * the read-only summary below shows who owns each floor.
 */
import { useState, useTransition } from 'react'
import { assignFloorTasksAction } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'
import type { FloorAssignment, HousekeeperOption } from '@/lib/data/types'

interface FloorAssignmentCardProps {
  assignments: FloorAssignment[]
  housekeepers: HousekeeperOption[]
}

const SELECT_CLASS =
  'min-w-0 bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50'

export function FloorAssignmentCard({ assignments, housekeepers }: FloorAssignmentCardProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [floor, setFloor] = useState('')
  const [housekeeperId, setHousekeeperId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const toast = useToast()

  const selectedFloor = assignments.find((a) => String(a.floor) === floor)
  const selectedName = housekeepers.find((h) => h.id === housekeeperId)?.fullName ?? ''
  const canSubmit = !!selectedFloor && housekeeperId !== '' && !isPending

  function handleConfirm() {
    if (!selectedFloor) return
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await assignFloorTasksAction(selectedFloor.floor, housekeeperId)
      if (result.ok) {
        toast.success(
          t('manager.housekeepingPage.floorTasksAssigned', {
            count: result.data?.moved ?? 0,
            name: selectedName,
            floor: selectedFloor.floor,
          }),
        )
        setFloor('')
        setHousekeeperId('')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
        {t('manager.housekeepingPage.floorAssignments')}
      </h3>

      <form
        className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) setConfirmOpen(true)
        }}
      >
        <select
          value={floor}
          disabled={isPending}
          onChange={(e) => setFloor(e.target.value)}
          aria-label={t('manager.housekeepingPage.selectFloor')}
          className={SELECT_CLASS}
        >
          <option value="">{t('manager.housekeepingPage.selectFloor')}</option>
          {assignments.map((a) => (
            <option key={a.floor} value={a.floor}>
              {t('manager.housekeepingPage.floorOption', { floor: a.floor, count: a.pendingTasks })}
            </option>
          ))}
        </select>
        <select
          value={housekeeperId}
          disabled={isPending}
          onChange={(e) => setHousekeeperId(e.target.value)}
          aria-label={t('manager.housekeepingPage.selectHousekeeper')}
          className={SELECT_CLASS}
        >
          <option value="">{t('manager.housekeepingPage.selectHousekeeper')}</option>
          {housekeepers.map((h) => (
            <option key={h.id} value={h.id}>
              {h.fullName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-container transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {isPending ? (
            <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
          ) : (
            <MaterialIcon name="check" size={16} />
          )}
          {t('manager.housekeepingPage.confirm')}
        </button>
      </form>

      {/* Read-only summary: who owns each floor + pending work. */}
      <ul className="flex flex-col divide-y divide-outline-variant">
        {assignments.map((a) => (
          <li key={a.floor} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-body-md font-semibold text-primary">
                {t('manager.housekeepingPage.floorN', { floor: a.floor })}
              </p>
              <p className="text-caption text-on-surface-variant">
                {t('manager.housekeepingPage.roomsCount', { count: a.totalRooms })} ·{' '}
                {t('manager.housekeepingPage.pendingN', { count: a.pendingTasks })}
              </p>
            </div>
            <span
              className={`text-body-md truncate ${a.housekeeperName ? 'text-on-surface' : 'text-on-surface-variant italic'}`}
            >
              {a.housekeeperName ?? t('manager.housekeepingPage.notAssigned')}
            </span>
          </li>
        ))}
      </ul>

      {confirmOpen && selectedFloor && (
        <ConfirmModal
          open
          body={
            selectedFloor.pendingTasks > 0
              ? t('manager.housekeepingPage.confirmAssignFloor', {
                  count: selectedFloor.pendingTasks,
                  floor: selectedFloor.floor,
                  name: selectedName,
                })
              : t('manager.housekeepingPage.confirmAssignFloorEmpty', {
                  floor: selectedFloor.floor,
                  name: selectedName,
                })
          }
          okLabel={t('manager.housekeepingPage.confirm')}
          cancelLabel={t('manager.housekeepingPage.cancel')}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}
