'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { Amenity, RoomType } from '@/lib/data/types'
import {
  createRoomTypeAction,
  updateRoomTypeAction,
} from '@/app/actions/admin/rates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { r2Url } from '@/lib/r2/publicUrl'
import { roomTypeLabel } from '@/lib/format/roomType'
import { useT } from '@/lib/i18n/useT'

interface RoomTypeFormProps {
  mode: 'create' | 'edit'
  initial?: RoomType
  /** Every amenity the site can render — shown as checkboxes. */
  amenityCatalog: Amenity[]
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
  const t = useT()
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
          {t('admin.common.saving')}
        </>
      ) : (
        label
      )}
    </button>
  )
}

/**
 * Image upload section: hero (single file, replaces) + gallery (multi-file, appends).
 *
 * Per-image delete UX (Phase 31.5 — form-submit model):
 * - Click × → mark for pending delete (local state only, no server round-trip)
 * - Pending-deleted images show opacity-40 + ring-error + ↺ undo affordance
 * - The "บันทึกการแก้ไข" submit button applies all staged deletes alongside
 *   any new uploads and field changes — no popup, no per-image server action
 *
 * Server-side hero promotion: if user marks hero for delete and gallery still
 * has ≥1 item, the server promotes the first remaining gallery image to hero.
 * (Same policy as the previous `deleteRoomTypeImageAction` — just deferred
 * to form submit now.)
 */
function RoomImagesSection({ initial, requireHero }: { initial?: RoomType; requireHero: boolean }) {
  const t = useT()
  const initialHero = initial?.hero_image_key ?? ''
  const initialGallery = useMemo(
    () => initial?.gallery_keys ?? [],
    [initial?.gallery_keys],
  )

  // Track staged deletions + hero delete flag locally. The visible gallery +
  // hero preview are derived from initial + these local mutations.
  const [deletedKeys, setDeletedKeys] = useState<ReadonlySet<string>>(new Set())
  const [pendingHeroDelete, setPendingHeroDelete] = useState(false)

  // Derived visible gallery (excludes pending-deleted keys).
  const visibleGallery = useMemo(
    () => initialGallery.filter((k) => !deletedKeys.has(k)),
    [initialGallery, deletedKeys],
  )

  // Current hero key for display + hidden input — equals initialHero unless
  // user staged a delete (we still show the existing image faded as the preview).
  const heroKey = initialHero

  // New uploads (preview only — DB write happens on form submit).
  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([])
  const objectUrlsRef = useRef<string[]>([])

  // Revoke any object URLs we created when the component unmounts.
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
    // Selecting a new hero implicitly cancels a pending hero delete — user
    // intent is clear: replace, not delete.
    setPendingHeroDelete(false)
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

  const toggleGalleryDelete = (key: string) => {
    setDeletedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleHeroDelete = () => setPendingHeroDelete((prev) => !prev)

  const pendingDeleteCount = deletedKeys.size + (pendingHeroDelete ? 1 : 0)

  // Server guard: hero deletion requires ≥1 remaining gallery item to promote.
  const canDeleteHero = !!heroKey && visibleGallery.length > 0

  const heroDisplay = heroPreview ?? (heroKey ? r2Url(heroKey) : '')
  const showHeroPreview = !!heroDisplay

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface-container-low border border-outline-variant rounded-lg">
      <div className="flex items-center gap-2">
        <MaterialIcon name="photo_library" size={20} className="text-secondary" />
        <span className="text-label-lg text-on-surface font-semibold">{t('admin.roomTypeForm.photos')}</span>
      </div>

      {initial?.id && (
        <input
          type="hidden"
          name="delete_image_keys"
          value={JSON.stringify([
            ...(pendingHeroDelete && heroKey ? [heroKey] : []),
            ...Array.from(deletedKeys),
          ])}
        />
      )}

      {/* Pending delete banner */}
      {pendingDeleteCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          <div className="flex items-center gap-2">
            <MaterialIcon name="delete_sweep" size={18} />
            <span>
              {t('admin.roomTypeForm.pendingDeleteAll', { count: pendingDeleteCount })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeletedKeys(new Set())
              setPendingHeroDelete(false)
            }}
            className="text-body-sm text-error underline hover:no-underline"
          >
            {t('admin.roomTypeForm.undoAll')}
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label-md text-on-surface">
            {t('admin.roomTypeForm.hero')}
            {requireHero && <span className="text-error">*</span>}
          </span>
          {pendingHeroDelete && (
            <span className="text-caption text-error uppercase tracking-wider font-semibold">
              {t('admin.roomTypeForm.willDelete')}
            </span>
          )}
        </div>
        {showHeroPreview && (
          <div
            className={`relative w-full aspect-[16/9] max-w-md rounded-lg overflow-hidden bg-surface-container group ${
              pendingHeroDelete ? 'opacity-40 ring-2 ring-error' : ''
            }`}
          >
            <Image
              src={heroDisplay}
              alt="Hero preview"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
            {heroKey && !heroPreview && !pendingHeroDelete && (
              <button
                type="button"
                onClick={canDeleteHero ? toggleHeroDelete : undefined}
                disabled={!canDeleteHero}
                title={canDeleteHero ? t('admin.roomTypeForm.heroDeleteTitle') : t('admin.roomTypeForm.heroDeleteBlocked')}
                className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-error text-on-error opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:cursor-not-allowed disabled:bg-on-surface-variant"
              >
                <MaterialIcon name="close" size={18} />
              </button>
            )}
            {pendingHeroDelete && (
              <button
                type="button"
                onClick={toggleHeroDelete}
                title={t('admin.roomTypeForm.heroUndoTitle')}
                className="absolute top-2 right-2 inline-flex items-center justify-center gap-2 px-3 h-9 rounded-full bg-primary text-on-primary font-semibold text-label-sm uppercase tracking-wider shadow-(--shadow-level-1)"
              >
                <MaterialIcon name="undo" size={16} />
                {t('admin.common.cancel')}
              </button>
            )}
          </div>
        )}
        <input
          type="file"
          name="hero_image_file"
          accept="image/jpeg,image/png,image/webp"
          required={requireHero}
          onChange={handleHeroChange}
          className="block w-full text-body-sm text-on-surface file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-secondary file:font-semibold file:cursor-pointer hover:file:bg-primary-container file:transition-colors"
        />
        <span className="text-body-sm text-on-surface-variant">
          {t('admin.roomTypeForm.uploadHint')}
        </span>
      </div>

      {/* Gallery */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label-md text-on-surface">{t('admin.roomTypeForm.gallery')}</span>
          {deletedKeys.size > 0 && (
            <span className="text-caption text-error uppercase tracking-wider font-semibold">
              {t('admin.roomTypeForm.pendingDelete', { count: deletedKeys.size })}
            </span>
          )}
        </div>

        {visibleGallery.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-on-surface-variant">
              {t('admin.roomTypeForm.currentGallery', { count: visibleGallery.length })}
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {visibleGallery.map((key) => {
                const isPendingDelete = deletedKeys.has(key)
                return (
                  <div
                    key={key}
                    className={`relative aspect-square rounded-md overflow-hidden bg-surface-container group ${
                      isPendingDelete ? 'opacity-40 ring-2 ring-error' : ''
                    }`}
                  >
                    <Image
                      src={r2Url(key)}
                      alt="Gallery"
                      fill
                      unoptimized
                      sizes="120px"
                      className="object-cover"
                    />
                    {!isPendingDelete && (
                      <button
                        type="button"
                        onClick={() => toggleGalleryDelete(key)}
                        title={t('admin.roomTypeForm.deleteTitle')}
                        className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-error text-on-error opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        <MaterialIcon name="close" size={14} />
                      </button>
                    )}
                    {isPendingDelete && (
                      <button
                        type="button"
                        onClick={() => toggleGalleryDelete(key)}
                        title={t('admin.roomTypeForm.undoTitle')}
                        className="absolute inset-0 inline-flex items-center justify-center bg-black/40"
                      >
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-on-primary text-label-sm font-semibold uppercase tracking-wider">
                          <MaterialIcon name="undo" size={14} />
                          {t('admin.common.cancel')}
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {galleryPreviews.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm text-on-surface-variant">
              {t('admin.roomTypeForm.newPhotos', { count: galleryPreviews.length })}
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
          {t('admin.roomTypeForm.galleryHint')}
        </span>
      </div>
    </div>
  )
}

export function RoomTypeForm({ mode, initial, amenityCatalog }: RoomTypeFormProps) {
  const t = useT()
  const router = useRouter()
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    if (mode === 'create') {
      const result = await createRoomTypeAction(formData)
      if (!result.ok) return { error: result.error }
      // Land on the edit page — that is where the physical rooms are added.
      if (result.data) router.push(`/admin/rates/room-types/${result.data.id}/edit?created=1`)
      return { success: true }
    }
    const result = await updateRoomTypeAction(formData)
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
          {t('admin.common.saved')}
        </div>
      )}

      {mode === 'edit' && initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('admin.roomTypeForm.slug')} required>
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

        <Field label={t('admin.roomTypeForm.basePrice')} required>
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

      {/* ============================================================
          Phase X — bilingual content (grouped sections).
          English fields are required; Thai fields are optional and
          fall back to the EN version on public pages when omitted.
          ============================================================ */}

      {/* English section (required) */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2 pb-2 border-b border-outline-variant">
          <span className="text-body-lg" aria-hidden>
            🌐
          </span>
          <h3 className="font-headline-sm text-headline-sm text-primary">
            English (required)
          </h3>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Room name" required>
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

          <Field label="View label (optional)">
            <input
              name="view_label"
              type="text"
              defaultValue={initial?.view_label ?? ''}
              placeholder="Garden View"
              maxLength={80}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Short description" required>
          <input
            name="short_desc"
            type="text"
            defaultValue={initial?.short_desc ?? ''}
            required
            maxLength={300}
            className={inputClass}
          />
        </Field>

        <Field label="Full description" required>
          <textarea
            name="description"
            defaultValue={initial?.description ?? ''}
            required
            maxLength={2000}
            rows={3}
            className={inputClass}
          />
        </Field>
      </section>

      {/* Thai section (optional) */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2 pb-2 border-b border-outline-variant">
          <span className="text-body-lg" aria-hidden>
            🌐
          </span>
          <h3 className="font-headline-sm text-headline-sm text-primary">
            {t('admin.roomTypeForm.thaiSection')}
          </h3>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('admin.roomTypeForm.nameTh')}>
            <input
              name="name_th"
              type="text"
              defaultValue={initial?.name_th ?? ''}
              placeholder={t('admin.roomTypeForm.nameThPlaceholder')}
              maxLength={120}
              className={inputClass}
            />
          </Field>

          <Field label={t('admin.roomTypeForm.viewTh')}>
            <input
              name="view_label_th"
              type="text"
              defaultValue={initial?.view_label_th ?? ''}
              placeholder={t('admin.roomTypeForm.viewThPlaceholder')}
              maxLength={80}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t('admin.roomTypeForm.shortDescTh')}>
          <input
            name="short_desc_th"
            type="text"
            defaultValue={initial?.short_desc_th ?? ''}
            placeholder={t('admin.roomTypeForm.fallbackPlaceholder')}
            maxLength={300}
            className={inputClass}
          />
        </Field>

        <Field label={t('admin.roomTypeForm.longDescTh')}>
          <textarea
            name="description_th"
            defaultValue={initial?.description_th ?? ''}
            placeholder={t('admin.roomTypeForm.fallbackPlaceholder')}
            maxLength={2000}
            rows={3}
            className={inputClass}
          />
        </Field>
      </section>

      <RoomImagesSection initial={initial} requireHero={mode === 'create'} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tier dropdown — Deluxe / Suite / Villa.
            Previously hardcoded to 'Deluxe' server-side; now user-selectable.
            Labels use the existing `roomTypeLabel(type, locale)` helper for
            bilingual display matching SeasonalRateForm's {rt.name} ({rt.name_th})
            pattern at components/admin/SeasonalRateForm.tsx:112. */}
        <Field label={t('admin.roomTypeForm.tier')} required>
          <select
            name="type"
            required
            defaultValue={initial?.type ?? ''}
            className={inputClass}
          >
            <option value="" disabled>
              {t('admin.roomTypeForm.tierPlaceholder')}
            </option>
            {(['Deluxe', 'Suite', 'Villa'] as const).map((t) => (
              <option key={t} value={t}>
                {roomTypeLabel(t, 'th')} ({roomTypeLabel(t, 'en')})
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('admin.roomTypeForm.bed')} required>
          <select
            name="bed_type"
            required
            defaultValue={initial?.bed_type ?? 'King'}
            className={inputClass}
          >
            <option value="King">King</option>
            <option value="Queen">Queen</option>
            <option value="Twin">Twin</option>
          </select>
        </Field>

        <Field label={t('admin.roomTypeForm.floor')} required>
          <input
            name="floor"
            type="number"
            min="1"
            max="50"
            step="1"
            defaultValue={initial?.floor ?? 1}
            required
            className={inputClass}
          />
        </Field>

        <Field label={t('admin.roomTypeForm.size')} required>
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

      <Field label={t('admin.roomTypeForm.maxGuests')} required>
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label-md text-on-surface mb-1">{t('admin.roomTypeForm.amenities')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {amenityCatalog.map((a) => (
            <label key={a.slug} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="amenities"
                value={a.slug}
                defaultChecked={initial?.amenities.includes(a.slug) ?? false}
                className="w-5 h-5 rounded border-outline-variant"
              />
              <MaterialIcon name={a.icon} size={18} className="text-on-surface-variant" />
              <span className="text-body-md text-on-surface">{a.name_th}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t('admin.common.status')}>
        <label className="inline-flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={initial?.is_active ?? true}
            className="w-5 h-5 rounded border-outline-variant"
          />
          <span className="text-body-md text-on-surface">{t('admin.roomTypeForm.bookable')}</span>
        </label>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={mode === 'create' ? t('admin.roomTypeForm.create') : t('admin.common.saveChanges')} />
        <a
          href="/admin/rates/room-types"
          className="inline-flex items-center justify-center px-6 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-medium text-body-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
        >
          {t('admin.common.cancel')}
        </a>
      </div>
    </form>
  )
}