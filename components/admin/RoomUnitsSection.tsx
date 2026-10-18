'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { AdminRoomUnit } from '@/lib/data/rooms'
import { createRoomUnitAction, setRoomUnitActiveAction } from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { ROOM_STATUS_KEY } from '@/components/manager/roomStatusBuckets'
import { useT } from '@/lib/i18n/useT'

interface RoomUnitsSectionProps {
  roomTypeId: string
  /** The room type's floor — default for the "add room" floor input. */
  defaultFloor: number
  units: AdminRoomUnit[]
}

const inputClass =
  'w-full bg-surface-container-low border border-outline-variant rounded-lg py-2 px-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

function AddButton() {
  const t = useT()
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-secondary rounded-lg font-semibold text-label-md hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      <MaterialIcon name="add" size={18} />
      {pending ? t('admin.roomUnits.adding') : t('admin.roomUnits.add')}
    </button>
  )
}

interface AddState {
  error?: string
  /** Bumped on every successful add — remounts the form to clear inputs. */
  added: number
}

/** Inline form: one physical room (เลขห้อง + ชั้น + วิว) for this room type. */
function AddUnitForm({ roomTypeId, defaultFloor }: { roomTypeId: string; defaultFloor: number }) {
  const t = useT()
  const [state, formAction] = useActionState(
    async (prev: AddState, formData: FormData): Promise<AddState> => {
      const result = await createRoomUnitAction(formData)
      return result.ok ? { added: prev.added + 1 } : { error: result.error, added: prev.added }
    },
    { added: 0 },
  )

  return (
    <form key={state.added} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="room_type_id" value={roomTypeId} />
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_1fr_auto] gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface">
            {t('admin.roomUnits.unitLabel')}<span className="text-error">*</span>
          </span>
          <input name="unit_label" required maxLength={20} placeholder="305" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface">
            {t('admin.roomUnits.floor')}<span className="text-error">*</span>
          </span>
          <input
            name="floor"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={defaultFloor}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface">{t('admin.roomUnits.viewOptional')}</span>
          <input name="view_label" maxLength={80} placeholder="Pool View" className={inputClass} />
        </label>
        <AddButton />
      </div>
      {state.error && <p className="text-body-sm text-error">{state.error}</p>}
    </form>
  )
}

function UnitToggle({ roomTypeId, unit }: { roomTypeId: string; unit: AdminRoomUnit }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()

  function handleConfirm() {
    setConfirming(false)
    const fd = new FormData()
    fd.set('unit_id', unit.id)
    fd.set('room_type_id', roomTypeId)
    fd.set('is_active', String(!unit.is_active))
    startTransition(async () => {
      const result = await setRoomUnitActiveAction(fd)
      if (!result.ok) toast.error(result.error, { title: t('admin.roomUnits.toggleFailed') })
      else router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-caption font-semibold transition-colors disabled:opacity-50 hover:bg-primary-fixed ${
          unit.is_active ? 'text-error' : 'text-primary'
        }`}
      >
        <MaterialIcon name={unit.is_active ? 'block' : 'check_circle'} size={14} />
        {pending ? '...' : unit.is_active ? t('admin.roomUnits.retire') : t('admin.roomUnits.reuse')}
      </button>
      {confirming && (
        <ConfirmModal
          open
          variant={unit.is_active ? 'danger' : 'default'}
          title={
            unit.is_active ? t('admin.roomUnits.retireConfirmTitle', { room: unit.unit_label }) : t('admin.roomUnits.reuseConfirmTitle', { room: unit.unit_label })
          }
          body={
            unit.is_active
              ? t('admin.roomUnits.retireConfirmBody')
              : t('admin.roomUnits.reuseConfirmBody')
          }
          okLabel={unit.is_active ? t('admin.roomUnits.retireOk') : t('admin.roomUnits.reuseOk')}
          onCancel={() => setConfirming(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}

export function RoomUnitsSection({ roomTypeId, defaultFloor, units }: RoomUnitsSectionProps) {
  const t = useT()
  const activeCount = units.filter((u) => u.is_active).length

  return (
    <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-4 mt-8">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MaterialIcon name="meeting_room" size={22} className="text-secondary" />
          <h2 className="font-headline-sm text-headline-sm text-primary">{t('admin.roomUnits.heading')}</h2>
        </div>
        <span className="text-body-md text-on-surface-variant">{t('admin.roomUnits.activeCount', { count: activeCount })}</span>
      </header>

      {activeCount === 0 && (
        <div className="flex items-start gap-2 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          <MaterialIcon name="warning" size={18} className="mt-0.5" />
          <span>{t('admin.roomUnits.noUnitsWarning')}</span>
        </div>
      )}

      {units.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-outline-variant">
              <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="text-left px-3 py-2 font-medium">{t('admin.roomUnits.unitLabel')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('admin.roomUnits.floor')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('admin.roomUnits.view')}</th>
                <th className="text-left px-3 py-2 font-medium">{t('admin.common.status')}</th>
                <th className="text-right px-3 py-2 font-medium">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {units.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 font-mono text-body-md text-primary">{u.unit_label}</td>
                  <td className="px-3 py-2 text-body-md">{u.floor}</td>
                  <td className="px-3 py-2 text-body-md text-on-surface-variant">{u.view_label ?? '—'}</td>
                  <td className="px-3 py-2 text-body-md">
                    {u.is_active ? t(ROOM_STATUS_KEY[u.status]) : t('admin.roomUnits.retired')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <UnitToggle roomTypeId={roomTypeId} unit={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddUnitForm roomTypeId={roomTypeId} defaultFloor={defaultFloor} />
    </section>
  )
}
