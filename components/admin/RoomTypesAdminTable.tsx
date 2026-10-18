'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RoomType } from '@/lib/data/types'
import { formatDateTime } from '@/lib/dates'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useLocale } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { useToast } from '@/components/ui/Toast'
import {
  setRoomTypeActiveAction,
  restoreRoomTypeAction,
  permanentlyDeleteRoomTypeAction,
} from '@/app/actions/admin/rates'
import { useT } from '@/lib/i18n/useT'

type TabKey = 'active' | 'inactive' | 'deleted'

interface RoomTypesAdminTableProps {
  roomTypes: RoomType[]
  /** Which tab the table is rendering — drives the available row actions. */
  tab: TabKey
  /** Active physical rooms per room type id — 0 means it cannot be booked. */
  unitCounts: Record<string, number>
}

/**
 * Phase 32 — row actions for the "active" tab.
 * Available actions: edit + deactivate (move to inactive tab).
 */
function ActiveRowActions({ id, name }: { id: string; name: string }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  async function handleDeactivate() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('is_active', 'false')
    setConfirmDeactivate(false)
    startTransition(async () => {
      await setRoomTypeActiveAction(fd)
      router.refresh()
    })
  }

  return (
    <>
      <Link
        href={`/admin/rates/room-types/${id}/edit`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="edit" size={16} />
        {t('admin.common.edit')}
      </Link>
      <button
        type="button"
        onClick={() => setConfirmDeactivate(true)}
        disabled={pending}
        title={t('admin.roomTypes.deactivateTitle', { name })}
        aria-label={t('admin.roomTypes.deactivateAria', { name })}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="block" size={18} />
      </button>
      {confirmDeactivate && (
        <ConfirmModal
          open
          title={t('admin.roomTypes.deactivateConfirmTitle')}
          body={t('admin.roomTypes.deactivateConfirmBody', { name })}
          okLabel={t('admin.roomTypes.deactivate')}
          onCancel={() => setConfirmDeactivate(false)}
          onConfirm={handleDeactivate}
        />
      )}
    </>
  )
}

/**
 * Phase 32 — row actions for the "inactive" tab.
 * Available actions: edit + reactivate (→ active) + soft-delete (→ deleted).
 */
function InactiveRowActions({ id, name }: { id: string; name: string }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmReactivate, setConfirmReactivate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleReactivate() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('is_active', 'true')
    setConfirmReactivate(false)
    startTransition(async () => {
      await setRoomTypeActiveAction(fd)
      router.refresh()
    })
  }

  async function handleSoftDelete() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('is_active', 'false')
    fd.set('deleted_at', new Date().toISOString())
    setConfirmDelete(false)
    startTransition(async () => {
      await setRoomTypeActiveAction(fd)
      router.refresh()
    })
  }

  return (
    <>
      <Link
        href={`/admin/rates/room-types/${id}/edit`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-md rounded-lg border border-outline-variant hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="edit" size={16} />
        {t('admin.common.edit')}
      </Link>
      <button
        type="button"
        onClick={() => setConfirmReactivate(true)}
        disabled={pending}
        title={t('admin.roomTypes.reactivateTitle', { name })}
        aria-label={t('admin.roomTypes.reactivateAria', { name })}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:bg-secondary-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="restore" size={18} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={pending}
        title={t('admin.roomTypes.softDeleteTitle', { name })}
        aria-label={t('admin.roomTypes.softDeleteAria', { name })}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete" size={18} />
      </button>
      {confirmReactivate && (
        <ConfirmModal
          open
          title={t('admin.roomTypes.reactivateConfirmTitle')}
          body={t('admin.roomTypes.reactivateConfirmBody', { name })}
          okLabel={t('admin.roomTypes.reactivate')}
          onCancel={() => setConfirmReactivate(false)}
          onConfirm={handleReactivate}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          open
          variant="danger"
          title={t('admin.roomTypes.softDeleteConfirmTitle')}
          body={t('admin.roomTypes.softDeleteConfirmBody', { name })}
          okLabel={t('admin.roomTypes.softDelete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleSoftDelete}
        />
      )}
    </>
  )
}

/**
 * Phase 32 — row actions for the "deleted" tab.
 * Available actions: restore (→ active) + permanent delete (hard DELETE).
 * No "edit" affordance — editing a soft-deleted row is rarely useful and
 * would confuse the user about which tab it would land in.
 */
function DeletedRowActions({ id, name }: { id: string; name: string }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmPermanent, setConfirmPermanent] = useState(false)
  const toast = useToast()

  async function handleRestore() {
    const fd = new FormData()
    fd.set('id', id)
    setConfirmRestore(false)
    startTransition(async () => {
      await restoreRoomTypeAction(fd)
      router.refresh()
    })
  }

  async function handlePermanentDelete() {
    const fd = new FormData()
    fd.set('id', id)
    setConfirmPermanent(false)
    startTransition(async () => {
      const result = await permanentlyDeleteRoomTypeAction(fd)
      if (!result.ok) {
        toast.error(result.error, { title: t('admin.roomTypes.purgeFailed') })
        // Don't refresh — keep the row on screen so admin can read the error.
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmRestore(true)}
        disabled={pending}
        title={t('admin.roomTypes.restoreTitle', { name })}
        aria-label={t('admin.roomTypes.restoreAria', { name })}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:bg-secondary-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="restore" size={18} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmPermanent(true)}
        disabled={pending}
        title={t('admin.roomTypes.purgeTitle', { name })}
        aria-label={t('admin.roomTypes.purgeAria', { name })}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete_forever" size={18} />
      </button>
      {confirmRestore && (
        <ConfirmModal
          open
          title={t('admin.roomTypes.restoreConfirmTitle')}
          body={t('admin.roomTypes.restoreConfirmBody', { name })}
          okLabel={t('admin.roomTypes.restore')}
          onCancel={() => setConfirmRestore(false)}
          onConfirm={handleRestore}
        />
      )}
      {confirmPermanent && (
        <ConfirmModal
          open
          variant="danger"
          title={t('admin.roomTypes.purgeConfirmTitle')}
          body={
            <>
              <p className="text-body-md text-on-surface">
                {t('admin.roomTypes.purgeConfirmBody', { name })}
              </p>
              <p className="text-body-md text-on-surface-variant mt-2">
                {t('admin.roomTypes.purgeConfirmHint')}
              </p>
            </>
          }
          okLabel={t('admin.roomTypes.purge')}
          onCancel={() => setConfirmPermanent(false)}
          onConfirm={handlePermanentDelete}
        />
      )}
    </>
  )
}

const EMPTY_STATE: Record<TabKey, string> = {
  active: 'admin.roomTypes.emptyActive',
  inactive: 'admin.roomTypes.emptyInactive',
  deleted: 'admin.roomTypes.emptyDeleted',
}

const EMPTY_ICON: Record<TabKey, string> = {
  active: 'bed',
  inactive: 'block',
  deleted: 'delete',
}

export function RoomTypesAdminTable({ roomTypes, tab, unitCounts }: RoomTypesAdminTableProps) {
  const t = useT()
  const locale = useLocale()
  if (roomTypes.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon
          name={EMPTY_ICON[tab]}
          size={48}
          className="text-on-surface-variant mb-3"
        />
        <p className="text-body-lg text-on-surface-variant">{t(EMPTY_STATE[tab])}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">{t('admin.roomTypes.colType')}</th>
              <th className="text-left px-4 py-3 font-medium">Slug (URL)</th>
              <th className="text-right px-4 py-3 font-medium">{t('admin.roomTypes.colBasePrice')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('admin.roomTypes.colGuests')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('admin.roomTypes.colSize')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('admin.roomTypes.colRooms')}</th>
              {tab === 'deleted' ? (
                <th className="text-left px-4 py-3 font-medium">{t('admin.roomTypes.colDeletedAt')}</th>
              ) : (
                <th className="text-left px-4 py-3 font-medium">{t('admin.common.status')}</th>
              )}
              <th className="text-right px-4 py-3 font-medium">{t('admin.common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {roomTypes.map((r) => (
              <tr key={r.id} className="hover:bg-primary-fixed transition-colors">
                <td className="px-4 py-4">
                  <p className="text-body-md font-medium text-primary">{r.name}</p>
                  <p className="text-caption text-on-surface-variant">{r.name_th}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="font-mono text-body-sm text-on-surface-variant">
                    {r.slug}
                  </span>
                </td>
                <td className="px-4 py-4 text-right text-body-md text-primary font-semibold">
                  {formatTHB(r.base_price)}
                </td>
                <td className="px-4 py-4 text-right text-body-md text-on-surface">
                  {t('admin.roomTypes.guestsN', { count: r.max_guests })}
                </td>
                <td className="px-4 py-4 text-right text-body-md text-on-surface">
                  {t('admin.roomTypes.sizeSqm', { count: r.size_sqm })}
                </td>
                <td className="px-4 py-4 text-right text-body-md">
                  {(unitCounts[r.id] ?? 0) > 0 ? (
                    <span className="text-on-surface">{t('admin.roomTypes.roomsN', { count: unitCounts[r.id] })}</span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-error"
                      title={t('admin.roomTypes.noRoomsTitle')}
                    >
                      <MaterialIcon name="warning" size={14} />
                      {t('admin.roomTypes.noRooms')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {tab === 'deleted' ? (
                    r.deleted_at ? (
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(r.deleted_at, LOCALE_BCP47[locale])}
                      </span>
                    ) : (
                      <span className="text-caption text-on-surface-variant italic">
                        {t('admin.common.unknown')}
                      </span>
                    )
                  ) : r.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="check_circle" size={12} />
                      {t('admin.roomTypes.statusOn')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="block" size={12} />
                      {t('admin.roomTypes.statusOff')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    {tab === 'active' ? (
                      <ActiveRowActions id={r.id} name={r.name} />
                    ) : tab === 'inactive' ? (
                      <InactiveRowActions id={r.id} name={r.name} />
                    ) : (
                      <DeletedRowActions id={r.id} name={r.name} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
