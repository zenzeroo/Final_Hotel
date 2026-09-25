'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RoomType } from '@/lib/data/types'
import { formatDateTime } from '@/lib/dates'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  setRoomTypeActiveAction,
  restoreRoomTypeAction,
  permanentlyDeleteRoomTypeAction,
} from '@/app/actions/admin/rates'

type TabKey = 'active' | 'inactive' | 'deleted'

interface RoomTypesAdminTableProps {
  roomTypes: RoomType[]
  /** Which tab the table is rendering — drives the available row actions. */
  tab: TabKey
}

/**
 * Phase 32 — row actions for the "active" tab.
 * Available actions: edit + deactivate (move to inactive tab).
 */
function ActiveRowActions({ id, name }: { id: string; name: string }) {
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
        แก้ไข
      </Link>
      <button
        type="button"
        onClick={() => setConfirmDeactivate(true)}
        disabled={pending}
        title={`ปิดใช้งาน ${name}`}
        aria-label={`ปิดใช้งานประเภทห้อง ${name}`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="block" size={18} />
      </button>
      {confirmDeactivate && (
        <ConfirmModal
          open
          title="ปิดใช้งานประเภทห้อง?"
          body={`ปิดใช้งานประเภทห้อง "${name}" ชั่วคราว? ประเภทห้องจะไม่ปรากฏในหน้าจอง แต่ยังอยู่ในแท็บ "ปิดชั่วคราว" และสามารถเปิดกลับได้`}
          okLabel="ปิดใช้งาน"
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
        แก้ไข
      </Link>
      <button
        type="button"
        onClick={() => setConfirmReactivate(true)}
        disabled={pending}
        title={`เปิดใช้งาน ${name} กลับ`}
        aria-label={`เปิดใช้งานประเภทห้อง ${name} กลับ`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:bg-secondary-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="restore" size={18} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        disabled={pending}
        title={`ลบ ${name}`}
        aria-label={`ลบประเภทห้อง ${name}`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete" size={18} />
      </button>
      {confirmReactivate && (
        <ConfirmModal
          open
          title="เปิดใช้งานประเภทห้อง?"
          body={`เปิดใช้งานประเภทห้อง "${name}" กลับ? ประเภทห้องจะกลับไปอยู่ในแท็บ "เปิดใช้งาน"`}
          okLabel="เปิดใช้งาน"
          onCancel={() => setConfirmReactivate(false)}
          onConfirm={handleReactivate}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          open
          variant="danger"
          title="ย้ายไปแท็บถูกลบ?"
          body={`ย้ายประเภทห้อง "${name}" ไปแท็บ "ถูกลบ"? ประวัติการจองจะยังคงอยู่ และสามารถกู้คืนได้จากแท็บ "ถูกลบ"`}
          okLabel="ลบ (ย้ายไปถูกลบ)"
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
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmPermanent, setConfirmPermanent] = useState(false)
  const [permanentError, setPermanentError] = useState<string | null>(null)

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
    setPermanentError(null)
    const fd = new FormData()
    fd.set('id', id)
    setConfirmPermanent(false)
    startTransition(async () => {
      const result = await permanentlyDeleteRoomTypeAction(fd)
      if (!result.ok) {
        setPermanentError(result.error)
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
        title={`กู้คืน ${name}`}
        aria-label={`กู้คืนประเภทห้อง ${name}`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:bg-secondary-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="restore" size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setPermanentError(null)
          setConfirmPermanent(true)
        }}
        disabled={pending}
        title={`ลบ ${name} ถาวร`}
        aria-label={`ลบประเภทห้อง ${name} ถาวร`}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
      >
        <MaterialIcon name="delete_forever" size={18} />
      </button>
      {confirmRestore && (
        <ConfirmModal
          open
          title="กู้คืนประเภทห้อง?"
          body={`กู้คืนประเภทห้อง "${name}" กลับมาเป็นเปิดใช้งาน? ประเภทห้องจะกลับไปอยู่ในแท็บ "เปิดใช้งาน" และพร้อมให้ลูกค้าจองอีกครั้ง`}
          okLabel="กู้คืน"
          onCancel={() => setConfirmRestore(false)}
          onConfirm={handleRestore}
        />
      )}
      {confirmPermanent && (
        <ConfirmModal
          open
          variant="danger"
          title="ลบประเภทห้องถาวร?"
          body={
            <>
              <p className="text-body-md text-on-surface">
                การลบถาวรจะลบประเภทห้อง <strong>&ldquo;{name}&rdquo;</strong> ออกจากฐานข้อมูลทั้งหมด
              </p>
              <p className="text-body-md text-on-surface-variant mt-2">
                หากมีประวัติการจอง/ห้องพัก/รีวิวผูกอยู่ ระบบจะปฏิเสธการลบ
                (จำเป็นต้องลบประวัติที่เกี่ยวข้องก่อน)
              </p>
            </>
          }
          okLabel="ลบถาวร"
          onCancel={() => setConfirmPermanent(false)}
          onConfirm={handlePermanentDelete}
        />
      )}
      {permanentError && (
        <div className="fixed bottom-6 right-6 z-50 bg-error-container text-on-error-container rounded-lg px-4 py-3 shadow-level-3 max-w-sm">
          <p className="text-body-md font-semibold">ลบถาวรไม่สำเร็จ</p>
          <p className="text-body-sm mt-1">{permanentError}</p>
          <button
            type="button"
            onClick={() => setPermanentError(null)}
            className="text-body-sm underline mt-2"
          >
            ปิด
          </button>
        </div>
      )}
    </>
  )
}

const EMPTY_STATE: Record<TabKey, string> = {
  active: 'ยังไม่มีประเภทห้องที่เปิดใช้งาน',
  inactive: 'ไม่มีประเภทห้องที่ปิดชั่วคราว',
  deleted: 'ไม่มีประวัติการลบ',
}

const EMPTY_ICON: Record<TabKey, string> = {
  active: 'bed',
  inactive: 'block',
  deleted: 'delete',
}

export function RoomTypesAdminTable({ roomTypes, tab }: RoomTypesAdminTableProps) {
  if (roomTypes.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon
          name={EMPTY_ICON[tab]}
          size={48}
          className="text-on-surface-variant mb-3"
        />
        <p className="text-body-lg text-on-surface-variant">{EMPTY_STATE[tab]}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">ประเภทห้อง</th>
              <th className="text-left px-4 py-3 font-medium">Slug (URL)</th>
              <th className="text-right px-4 py-3 font-medium">ราคาฐาน</th>
              <th className="text-right px-4 py-3 font-medium">ผู้เข้าพัก</th>
              <th className="text-right px-4 py-3 font-medium">ขนาด</th>
              {tab === 'deleted' ? (
                <th className="text-left px-4 py-3 font-medium">ถูกลบเมื่อ</th>
              ) : (
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
              )}
              <th className="text-right px-4 py-3 font-medium">จัดการ</th>
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
                  {r.max_guests} คน
                </td>
                <td className="px-4 py-4 text-right text-body-md text-on-surface">
                  {r.size_sqm} ตร.ม.
                </td>
                <td className="px-4 py-4">
                  {tab === 'deleted' ? (
                    r.deleted_at ? (
                      <span className="text-caption text-on-surface-variant">
                        {formatDateTime(r.deleted_at, 'th-TH')}
                      </span>
                    ) : (
                      <span className="text-caption text-on-surface-variant italic">
                        ไม่ทราบ
                      </span>
                    )
                  ) : r.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="check_circle" size={12} />
                      เปิด
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                      <MaterialIcon name="block" size={12} />
                      ปิด
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
