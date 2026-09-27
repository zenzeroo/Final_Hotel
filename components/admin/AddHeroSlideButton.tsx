'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { AlertModal } from '@/components/ui/AlertModal'
import { r2Url } from '@/lib/r2/publicUrl'
import {
  addHeroSlideFromRoomTypeAction,
  addHeroSlideFromPromotionAction,
  addHeroSlideCustomAction,
} from '@/app/actions/admin/hero-carousel'

interface RoomTypeOption {
  id: string
  name: string
  heroImageKey: string
}

interface PromotionOption {
  id: string
  name: string
  imageKey: string
}

interface AddHeroSlideButtonProps {
  disabled: boolean
  roomTypes: RoomTypeOption[]
  promotions: PromotionOption[]
  usedRoomTypeIds: string[]
  usedPromotionIds: string[]
}

type Tab = 'room_type' | 'promotion' | 'custom'

export function AddHeroSlideButton({
  disabled,
  roomTypes,
  promotions,
  usedRoomTypeIds,
  usedPromotionIds,
}: AddHeroSlideButtonProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('room_type')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSuccess() {
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'ถึงขีดจำกัด 8 สไลด์แล้ว — ปิดใช้งานหรือลบสไลด์อื่นก่อน' : undefined}
        className="inline-flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <MaterialIcon name="add" size={18} />
        <span className="text-label-md uppercase tracking-wider font-semibold">เพิ่มสไลด์</span>
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (!isPending) setOpen(false)
        }}
        title="เพิ่มสไลด์ใหม่"
        maxWidthClass="max-w-2xl"
        showCloseButton
        body={
          <div className="flex flex-col gap-4">
            {/* Tab switcher */}
            <div className="flex items-center gap-2 border-b border-outline-variant">
              <TabButton
                label="จากห้องพัก"
                icon="hotel"
                active={tab === 'room_type'}
                onClick={() => setTab('room_type')}
              />
              <TabButton
                label="จากโปรโมชั่น"
                icon="sell"
                active={tab === 'promotion'}
                onClick={() => setTab('promotion')}
              />
              <TabButton
                label="อัปโหลดเอง"
                icon="upload"
                active={tab === 'custom'}
                onClick={() => setTab('custom')}
              />
            </div>

            {/* Tab content */}
            {tab === 'room_type' && (
              <RoomTypePickerTab
                roomTypes={roomTypes}
                usedRoomTypeIds={usedRoomTypeIds}
                isPending={isPending}
                onAdded={handleSuccess}
                onError={setAlertMessage}
                startTransition={startTransition}
              />
            )}
            {tab === 'promotion' && (
              <PromotionPickerTab
                promotions={promotions}
                usedPromotionIds={usedPromotionIds}
                isPending={isPending}
                onAdded={handleSuccess}
                onError={setAlertMessage}
                startTransition={startTransition}
              />
            )}
            {tab === 'custom' && (
              <CustomUploadTab
                isPending={isPending}
                onAdded={handleSuccess}
                onError={setAlertMessage}
                startTransition={startTransition}
              />
            )}
          </div>
        }
      />

      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}
    </>
  )
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-secondary text-primary font-semibold'
          : 'border-transparent text-on-surface-variant hover:text-primary'
      }`}
    >
      <MaterialIcon name={icon} size={18} />
      <span className="text-label-md uppercase tracking-wider">{label}</span>
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Tab: Room type picker
// ──────────────────────────────────────────────────────────────────────────

function RoomTypePickerTab({
  roomTypes,
  usedRoomTypeIds,
  isPending,
  onAdded,
  onError,
  startTransition,
}: {
  roomTypes: RoomTypeOption[]
  usedRoomTypeIds: string[]
  isPending: boolean
  onAdded: () => void
  onError: (msg: string) => void
  startTransition: (cb: () => Promise<void>) => void
}) {
  if (roomTypes.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant py-4">
        ไม่มีห้องพักที่มีรูป Hero — เพิ่มรูป Hero ให้ห้องพักก่อน
      </p>
    )
  }

  function pick(roomTypeId: string) {
    startTransition(async () => {
      const result = await addHeroSlideFromRoomTypeAction({ roomTypeId })
      if (result.ok) onAdded()
      else onError(result.error ?? 'ไม่สามารถเพิ่มสไลด์ได้')
    })
  }

  const usedSet = new Set(usedRoomTypeIds)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto py-2">
      {roomTypes.map((r) => {
        const used = usedSet.has(r.id)
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => !used && pick(r.id)}
            disabled={used || isPending}
            className="group relative aspect-video rounded-xl overflow-hidden bg-surface-container border border-outline-variant hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r2Url(r.heroImageKey)}
              alt={r.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-caption text-white font-medium truncate">{r.name}</p>
            </div>
            {used && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] uppercase tracking-wider font-semibold">
                ใช้แล้ว
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Tab: Promotion picker
// ──────────────────────────────────────────────────────────────────────────

function PromotionPickerTab({
  promotions,
  usedPromotionIds,
  isPending,
  onAdded,
  onError,
  startTransition,
}: {
  promotions: PromotionOption[]
  usedPromotionIds: string[]
  isPending: boolean
  onAdded: () => void
  onError: (msg: string) => void
  startTransition: (cb: () => Promise<void>) => void
}) {
  if (promotions.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant py-4">
        ไม่มีโปรโมชั่นที่เปิดใช้งานและมีรูป — เพิ่มรูปให้โปรโมชั่นก่อน
      </p>
    )
  }

  function pick(promotionId: string) {
    startTransition(async () => {
      const result = await addHeroSlideFromPromotionAction({ promotionId })
      if (result.ok) onAdded()
      else onError(result.error ?? 'ไม่สามารถเพิ่มสไลด์ได้')
    })
  }

  const usedSet = new Set(usedPromotionIds)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto py-2">
      {promotions.map((p) => {
        const used = usedSet.has(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => !used && pick(p.id)}
            disabled={used || isPending}
            className="group relative aspect-video rounded-xl overflow-hidden bg-surface-container border border-outline-variant hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r2Url(p.imageKey)}
              alt={p.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-caption text-white font-medium truncate">{p.name}</p>
            </div>
            {used && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] uppercase tracking-wider font-semibold">
                ใช้แล้ว
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Tab: Custom upload
// ──────────────────────────────────────────────────────────────────────────

function CustomUploadTab({
  isPending,
  onAdded,
  onError,
  startTransition,
}: {
  isPending: boolean
  onAdded: () => void
  onError: (msg: string) => void
  startTransition: (cb: () => Promise<void>) => void
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const file = fd.get('customImage')
    if (!(file instanceof File) || file.size === 0) {
      onError('กรุณาเลือกไฟล์รูปภาพ')
      return
    }
    startTransition(async () => {
      const result = await addHeroSlideCustomAction(fd)
      if (result.ok) {
        form.reset()
        onAdded()
      } else onError(result.error ?? 'ไม่สามารถเพิ่มสไลด์ได้')
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 py-2"
    >
      <div className="flex flex-col gap-2">
        <label className="text-label-md text-on-surface" htmlFor="customImage">
          รูปภาพ <span className="text-error">*</span>
        </label>
        <input
          id="customImage"
          name="customImage"
          type="file"
          accept="image/*"
          required
          className="block w-full text-body-md text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-on-primary file:cursor-pointer hover:file:bg-primary-fixed hover:file:text-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-label-md text-on-surface" htmlFor="customCaptionTh">
          คำบรรยาย (ภาษาไทย)
        </label>
        <input
          id="customCaptionTh"
          name="customCaptionTh"
          type="text"
          maxLength={500}
          placeholder="เช่น ห้องพักใหม่เปิดให้บริการแล้ว"
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-label-md text-on-surface" htmlFor="customCaption">
          คำบรรยาย (English)
        </label>
        <input
          id="customCaption"
          name="customCaption"
          type="text"
          maxLength={500}
          placeholder="e.g. New room type now available"
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              กำลังอัปโหลด…
            </>
          ) : (
            <>
              <MaterialIcon name="upload" size={18} />
              อัปโหลดและเพิ่มสไลด์
            </>
          )}
        </button>
      </div>
    </form>
  )
}
