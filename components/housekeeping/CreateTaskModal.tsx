'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AlertModal } from '@/components/ui/AlertModal'
import { createTask } from '@/app/actions/housekeeping'
import { useT } from '@/lib/i18n/useT'
import type { HousekeeperOption, HousekeepingTaskPriority, HousekeepingTaskType, RoomUnitBasic } from '@/lib/data/types'

interface CreateTaskModalProps {
  roomUnits: RoomUnitBasic[]
  housekeepers: HousekeeperOption[]
}

const TASK_TYPES: HousekeepingTaskType[] = ['cleaning', 'turn_down', 'deep_clean', 'inspection', 'restock']
const PRIORITIES: HousekeepingTaskPriority[] = ['low', 'normal', 'high', 'urgent']

export function CreateTaskModal({ roomUnits, housekeepers }: CreateTaskModalProps) {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createTask({
        roomUnitId: form.get('roomUnitId') as string,
        taskType: form.get('taskType') as HousekeepingTaskType,
        priority: form.get('priority') as HousekeepingTaskPriority,
        assignedTo: (form.get('assignedTo') as string) || null,
        notes: (form.get('notes') as string) || undefined,
      })
      if (result.ok) {
        setIsOpen(false)
        e.currentTarget?.reset()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="add_task" size={18} />
        {t('manager.housekeepingPage.createTask')}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-level-2 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-headline-sm text-primary">
                {t('manager.housekeepingPage.createTaskTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
              >
                <MaterialIcon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
                  {t('manager.housekeepingPage.room')}
                </label>
                <select
                  name="roomUnitId"
                  required
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">—</option>
                  {roomUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.floor}·{u.unit_label}
                      {u.room_type ? ` — ${u.room_type.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
                  {t('manager.housekeepingPage.taskType')}
                </label>
                <select
                  name="taskType"
                  required
                  defaultValue="cleaning"
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  {TASK_TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {t(`manager.housekeepingPage.type${tt.charAt(0).toUpperCase()}${tt.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
                  {t('manager.housekeepingPage.priority')}
                </label>
                <select
                  name="priority"
                  required
                  defaultValue="normal"
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`manager.housekeepingPage.priority${p.charAt(0).toUpperCase()}${p.slice(1)}` as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
                  {t('manager.housekeepingPage.assignee')}
                </label>
                <select
                  name="assignedTo"
                  defaultValue=""
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">{t('manager.housekeepingPage.notAssigned')}</option>
                  {housekeepers.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-caption text-on-surface-variant uppercase tracking-wider mb-1.5">
                  {t('manager.housekeepingPage.notesOptional')}
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              {error && <p className="text-body-md text-error">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 border border-outline-variant rounded-md text-body-md text-primary hover:bg-primary-fixed hover:border-primary-fixed transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                >
                  {t('common.cancel') ?? 'ยกเลิก'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-primary text-on-primary rounded-md text-caption uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50"
                >
                  {isPending ? '...' : t('manager.housekeepingPage.createTask')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && !isOpen && (
        <AlertModal open onClose={() => setError(null)} body={error} />
      )}
    </>
  )
}