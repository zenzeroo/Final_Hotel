'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import type { RoomType } from '@/lib/data/types'
import { createRoomTypeAction, updateRoomTypeAction } from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
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
 */
function RoomImagesSection({ initial }: { initial?: RoomType }) {
  const heroUrl = initial?.hero_image_key ? r2Url(initial.hero_image_key) : ''
  const existingGallery = initial?.gallery_keys ?? []

  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([])
  const objectUrlsRef = useRef<string[]>([])

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
    // Revoke previous previews before creating new ones.
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
    const urls = files.map((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return url
    })
    setGalleryPreviews(urls)
  }

  const heroDisplay = heroPreview ?? heroUrl
  const hasExistingGallery = existingGallery.length > 0
  const hasNewGallery = galleryPreviews.length > 0

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface-container-low border border-outline-variant rounded-lg">
      <div className="flex items-center gap-2">
        <MaterialIcon name="photo_library" size={20} className="text-secondary" />
        <span className="text-label-lg text-on-surface font-semibold">รูปภาพห้อง</span>
      </div>

      {initial?.id && (
        <input type="hidden" name="existing_gallery_keys" value={JSON.stringify(existingGallery)} />
      )}

      {/* Hero */}
      <div className="flex flex-col gap-2">
        <span className="text-label-md text-on-surface">รูป Hero (ภาพหลัก)</span>
        {heroDisplay && (
          <div className="relative w-full aspect-[16/9] max-w-md rounded-lg overflow-hidden bg-surface-container">
            <Image
              src={heroDisplay}
              alt="Hero preview"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
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
              รูป Gallery ปัจจุบัน ({existingGallery.length} รูป):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {existingGallery.map((key) => (
                <div
                  key={key}
                  className="relative aspect-square rounded-md overflow-hidden bg-surface-container"
                >
                  <Image
                    src={r2Url(key)}
                    alt="Gallery"
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
          รูปใหม่จะถูกเพิ่มต่อท้าย gallery เดิม (ไม่ลบรูปเก่า)
        </span>
      </div>
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
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-surface-container-high transition-colors"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
