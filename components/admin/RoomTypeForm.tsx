'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import type { RoomType } from '@/lib/data/types'
import {
  createRoomTypeAction,
  updateRoomTypeAction,
  deleteRoomTypeImageAction,
} from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { r2Url } from '@/lib/r2/publicUrl'

interface RoomTypeFormProps {
  mode: 'create' | 'edit'
  initial?: RoomType
}

interface FormState {
  error?: string
  success?: boolean
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังบันทึก…
        </>
      ) : (
        label
      )}
    </button>
  )
}

/**
 * Image upload section: hero (single file, replaces) + gallery (multi-file, appends).
 * Shows live previews for newly selected files via `URL.createObjectURL`.
 * Existing gallery keys are forwarded to the server action via a hidden JSON input
 * so updates don't wipe the gallery when only adding more.
 *
 * Per-image delete: × overlay button on each existing thumbnail (hero + gallery).
 * Confirms via Modal before calling `deleteRoomTypeImageAction`. Deletes are
 * tracked locally via `deletedKeys` + `promotedHeroKey` — the visible gallery
 * and hero are *derived* from `initial` props + these local mutations (no
 * setState-in-effect anti-pattern).
 *
 * Hero delete policy: server auto-promotes first gallery image to hero; client
 * mirrors that by storing the promoted key in `promotedHeroKey` so the UI stays
 * in sync without a server refresh.
 */
function RoomImagesSection({ initial }: { initial?: RoomType }) {
  const initialHero = initial?.hero_image_key ?? ''
  const initialGallery = useMemo(
    () => initial?.gallery_keys ?? [],
    [initial?.gallery_keys],
  )

  // Track deletions + hero promotion locally. The hero + visible gallery are
  // *derived* from these states + props (no useEffect sync).
  const [deletedKeys, setDeletedKeys] = useState<ReadonlySet<string>>(new Set())
  const [promotedHeroKey, setPromotedHeroKey] = useState<string | null>(null)

  // Derived current hero — promoted key wins over the initial prop.
  const heroKey = promotedHeroKey ?? initialHero

  // Derived visible gallery — exclude deleted keys AND the current hero
  // (a promoted gallery key shouldn't appear in both hero + gallery).
  const visibleGallery = useMemo(
    () =>
      initialGallery.filter(
        (k) => !deletedKeys.has(k) && k !== heroKey,
      ),
    [initialGallery, deletedKeys, heroKey],
  )

  // Local UI-only state (preview object URLs + delete modal).
  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([])
  const objectUrlsRef = useRef<string[]>([])

  const [deleteTarget, setDeleteTarget] = useState<{ key: string; isHero: boolean } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  // Revoke any object URLs we created when the component unmounts (memory leak guard).
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setHeroPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    setHeroPreview(url)
  }

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    const urls = files.map((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return url
    })
    setGalleryPreviews(urls)
  }

  const requestDelete = (key: string, isHero: boolean) => {
    setDeleteTarget({ key, isHero })
    setDeleteError(null)
  }

  const cancelDelete = () => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const confirmDelete = () => {
    if (!deleteTarget || !initial?.id) return
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteRoomTypeImageAction({
        roomTypeId: initial.id,
        key: deleteTarget.key,
      })
      if (!result.ok) {
        setDeleteError(result.error)
        return
      }
      // Mark the deleted key (so it's filtered from visible gallery) AND
      // optionally promote a gallery key to hero on success.
      setDeletedKeys((prev) => {
        const next = new Set(prev)
        next.add(deleteTarget.key)
        return next
      })
      if (result.data.newHeroKey) {
        setPromotedHeroKey(result.data.newHeroKey)
      }
      setDeleteTarget(null)
    })
  }

  const heroDisplay = heroPreview ?? (heroKey ? r2Url(heroKey) : '')
  const hasExistingGallery = visibleGallery.length > 0
  const hasNewGallery = galleryPreviews.length > 0
  // Server guard: hero deletion requires ≥1 remaining gallery item to promote.
  const canDeleteHero = !!heroKey && visibleGallery.length > 0

  const confirmBody =
    deleteTarget?.isHero
      ? canDeleteHero
        ? 'ลบ hero แล้วเลื่อน gallery รูปแรกขึ้นเป็น hero แทน? การลบไม่สามารถยกเลิกได้'
        : 'ไม่สามารถลบ hero ได้ — ต้องมีรูปในระบบอย่างน้อย 1 รูป (อัปโหลดรูปใหม่ก่อน)'
      : 'ลบรูปนี้ออกจาก gallery? การลบไม่สามารถยกเลิกได้'

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface-container-low border border-outline-variant rounded-lg">
      <div className="flex items-center gap-2">
        <MaterialIcon name="photo_library" size={20} className="text-secondary" />
        <span className="text-label-lg text-on-surface font-semibold">รูปภาพห้อง</span>
      </div>

      {initial?.id && (
        <input
          type="hidden"
          name="existing_gallery_keys"
          value={JSON.stringify(visibleGallery)}
        />
      )}

      {/* Hero */}
      <div className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface">รูป Hero (ภาพหลัก)</span>
        {heroDisplay && (
          <div className="relative w-full aspect-[16/9] max-w-md rounded-lg overflow-hidden bg-surface-container group">
            <Image
              src={heroDisplay}
              alt="Hero preview"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
            {heroKey && !heroPreview && (
              <button
                type="button"
                onClick={() => canDeleteHero && requestDelete(heroKey, true)}
                disabled={!canDeleteHero}
                title={canDeleteHero ? 'ลบ hero' : 'ต้องมีรูปอื่นในระบบก่อนลบ hero'}
                className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-error text-on-error opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:cursor-not-allowed disabled:bg-on-surface-variant"
              >
                <MaterialIcon name="close" size={18} />
              </button>
            )}
          </div>
        )}
        <input
          type="file"
          name="hero_image_file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleHeroChange}
          className="block w-full text-body-sm text-on-surface file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-secondary file:font-semibold file:cursor-pointer hover:file:bg-primary-container file:transition-colors"
        />
        <span className="text-body-sm text-on-surface-variant">
          JPEG / PNG / WebP, สูงสุด 10 MB · อัปโหลดใหม่จะแทนที่รูปเดิม
        </span>
      </div>

      {/* Gallery */}
      <div className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface">รูป Gallery (เพิ่มได้หลายรูป)</span>

        {hasExistingGallery && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-on-surface-variant">
              รูป Gallery ปัจจุบัน ({visibleGallery.length} รูป):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {visibleGallery.map((key) => (
                <div
                  key={key}
                  className="relative aspect-square rounded-md overflow-hidden bg-surface-container group"
                >
                  <Image
                    src={r2Url(key)}
                    alt="Gallery"
                    fill
                    unoptimized
                    sizes="120px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => requestDelete(key, false)}
                    title="ลบรูปนี้"
                    className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-error text-on-error opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <MaterialIcon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasNewGallery && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-on-surface-variant">
              รูปใหม่ที่จะเพิ่ม ({galleryPreviews.length} รูป):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {galleryPreviews.map((url, i) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-md overflow-hidden bg-surface-container ring-2 ring-secondary"
                >
                  <Image
                    src={url}
                    alt={`New ${i + 1}`}
                    fill
                    unoptimized
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          type="file"
          name="gallery_image_files"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleGalleryChange}
          className="block w-full text-body-sm text-on-surface file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-secondary file:font-semibold file:cursor-pointer hover:file:bg-primary-container file:transition-colors"
        />
        <span className="text-body-sm text-on-surface-variant">
          รูปใหม่จะถูกเพิ่มต่อท้าย gallery เดิม (ไม่ลบรูปเก่า) · คลิก × ที่รูปเพื่อลบ
        </span>
      </div>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={cancelDelete}
        title="ยืนยันการลบรูปภาพ"
        body={
          <div className="flex flex-col gap-2">
            <p>{confirmBody}</p>
            {deleteError && (
              <p className="text-body-sm text-error">⚠ {deleteError}</p>
            )}
          </div>
        }
        actions={[
          {
            label: isDeleting ? 'กำลังลบ…' : 'ลบรูปภาพ',
            onClick: confirmDelete,
            disabled: isDeleting || (deleteTarget?.isHero === true && !canDeleteHero),
            variant: 'danger',
          },
          {
            label: 'ยกเลิก',
            onClick: cancelDelete,
            disabled: isDeleting,
            variant: 'ghost',
          },
        ]}
        variant="danger"
        closeOnBackdrop={false}
      />
    </div>
  )
}

export function RoomTypeForm({ mode, initial }: RoomTypeFormProps) {
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const rawAction = mode === 'create' ? createRoomTypeAction : updateRoomTypeAction
    const result = await rawAction(formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  return (
    <form action={formAction} className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 flex flex-col gap-5">
      {state?.error && (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="check_circle" size={18} />
          บันทึกสำเร็จ
        </div>
      )}

      {mode === 'edit' && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug (ใช้ใน URL)" required>
          <input
            name="slug"
            type="text"
            defaultValue={initial?.slug ?? ''}
            placeholder="deluxe-garden-view"
            required
            maxLength={80}
            pattern="[a-z0-9\-]+"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="ราคาฐาน (THB/คืน)" required>
          <input
            name="base_price"
            type="number"
            min="1"
            step="0.01"
            defaultValue={initial?.base_price ?? 3000}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อห้อง (EN)" required>
          <input
            name="name"
            type="text"
            defaultValue={initial?.name ?? ''}
            placeholder="Deluxe Garden View"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="ชื่อห้อง (TH)" required>
          <input
            name="name_th"
            type="text"
            defaultValue={initial?.name_th ?? ''}
            placeholder="ห้องดีลักซ์วิวสวน"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="คำอธิบายสั้น" required>
        <input
          name="short_desc"
          type="text"
          defaultValue={initial?.short_desc ?? ''}
          required
          maxLength={300}
          className={inputClass}
        />
      </Field>

      <Field label="คำอธิบายเต็ม" required>
        <textarea
          name="description"
          defaultValue={initial?.description ?? ''}
          required
          maxLength={2000}
          rows={3}
          className={inputClass}
        />
      </Field>

      <RoomImagesSection initial={initial} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="จำนวนผู้เข้าพักสูงสุด" required>
          <input
            name="max_guests"
            type="number"
            min="1"
            max="20"
            step="1"
            defaultValue={initial?.max_guests ?? 2}
            required
            className={inputClass}
          />
        </Field>

        <Field label="ขนาดห้อง (ตร.ม.)" required>
          <input
            name="size_sqm"
            type="number"
            min="1"
            step="0.1"
            defaultValue={initial?.size_sqm ?? 30}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="สถานะ">
        <label className="inline-flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={initial?.is_active ?? true}
            className="w-5 h-5 rounded border-outline-variant"
          />
          <span className="text-body-md text-on-surface">เปิดให้จอง</span>
        </label>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={mode === 'create' ? 'สร้างประเภทห้อง' : 'บันทึกการแก้ไข'} />
        <a
          href="/admin/rates"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}