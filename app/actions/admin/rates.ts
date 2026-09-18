'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { createRoomType, updateRoomType, listRoomTypes } from '@/lib/data/rooms'
import { createSeasonalRate } from '@/lib/data/manager'
import {
  uploadImageToR2,
  roomImageKey,
  pickExt,
  R2UploadError,
} from '@/lib/r2/upload'
import { deleteObjectFromR2 } from '@/lib/r2/delete'

export type ActionResult = { ok: true } | { ok: false; error: string }

// =====================================================
// Room type actions
// =====================================================

const roomTypeSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  name_th: z.string().max(120),
  short_desc: z.string().min(1).max(300),
  description: z.string().min(1).max(2000),
  base_price: z.number().positive(),
  max_guests: z.number().int().min(1).max(20),
  size_sqm: z.number().positive(),
  is_active: z.boolean(),
})

/** Filter FormData entry collection down to actual `File` instances (skip empty placeholders). */
function collectFiles(values: FormDataEntryValue[]): File[] {
  return values.filter(
    (v): v is File => v instanceof File && v.size > 0 && v.type.length > 0,
  )
}

export async function createRoomTypeAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/rates')

  const candidate = {
    slug: String(formData.get('slug') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    name_th: String(formData.get('name_th') ?? '').trim(),
    short_desc: String(formData.get('short_desc') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    base_price: Number(formData.get('base_price') ?? 0),
    max_guests: Number(formData.get('max_guests') ?? 1),
    size_sqm: Number(formData.get('size_sqm') ?? 0),
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = roomTypeSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  // Upload hero + gallery files to R2 first — if upload fails we abort BEFORE
  // creating the room row (so we never end up with a room pointing at a half-uploaded
  // image set).
  const heroFile = formData.get('hero_image_file')
  const galleryFiles = collectFiles(formData.getAll('gallery_image_files'))

  let hero_image_key = ''
  const gallery_keys: string[] = []

  try {
    if (heroFile instanceof File && heroFile.size > 0 && heroFile.type.length > 0) {
      const ext = pickExt(heroFile)
      const key = roomImageKey(parsed.data.slug, 'hero', ext)
      const result = await uploadImageToR2(heroFile, key)
      hero_image_key = result.key
    }
    for (const file of galleryFiles) {
      const ext = pickExt(file)
      const key = roomImageKey(parsed.data.slug, 'gallery', ext)
      const result = await uploadImageToR2(file, key)
      gallery_keys.push(result.key)
    }
  } catch (e) {
    if (e instanceof R2UploadError) return { ok: false, error: e.message }
    return actionFail(e, 'Image upload failed')
  }

  const existing = await listRoomTypes()
  const createArgs = {
    ...parsed.data,
    bed_type: 'King' as const,
    floor: existing.length > 0 ? Math.max(...existing.map((r) => r.floor)) + 1 : 1,
    type: 'Deluxe' as const,
    hero_image_key,
    gallery_keys,
    amenities: [] as string[],
    rating_avg: 0,
    rating_count: 0,
  }

  try {
    await createRoomType(createArgs)
  } catch (e) {
    return actionFail(e, 'Could not create room type')
  }

  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  revalidatePath('/rooms')
  return { ok: true }
}

const roomTypeUpdateSchema = roomTypeSchema.partial().extend({ id: z.string().min(1) })

/** Parse a JSON-encoded string[] from FormData (e.g. `existing_gallery_keys`, `delete_image_keys`). */
function parseStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export async function updateRoomTypeAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/rates')

  const candidate = {
    id: String(formData.get('id') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    name_th: String(formData.get('name_th') ?? '').trim(),
    short_desc: String(formData.get('short_desc') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    base_price: Number(formData.get('base_price') ?? 0),
    max_guests: Number(formData.get('max_guests') ?? 1),
    size_sqm: Number(formData.get('size_sqm') ?? 0),
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = roomTypeUpdateSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  const { id, ...rest } = parsed.data

  // Image state from form (carried via hidden inputs):
  //   - existing_hero_key: current hero key (always sent)
  //   - existing_gallery_keys: gallery keys AFTER the form's deletedKeys filter
  //   - delete_image_keys: pending-deleted keys (hero + gallery combined)
  const existingHeroKey = String(formData.get('existing_hero_key') ?? '')
  const existingGalleryKeys = parseStringArray(formData.get('existing_gallery_keys'))
  const deleteKeys = parseStringArray(formData.get('delete_image_keys'))

  // Upload any new files first. The hero upload REPLACES; gallery uploads APPEND.
  const heroFile = formData.get('hero_image_file')
  const galleryFiles = collectFiles(formData.getAll('gallery_image_files'))

  const newHeroKeys: string[] = [] // 0 or 1 entry
  const newGalleryKeys: string[] = []

  try {
    if (heroFile instanceof File && heroFile.size > 0 && heroFile.type.length > 0) {
      const slugForKey = rest.slug ?? id
      const ext = pickExt(heroFile)
      const key = roomImageKey(slugForKey, 'hero', ext)
      const result = await uploadImageToR2(heroFile, key)
      newHeroKeys.push(result.key)
    }
    for (const file of galleryFiles) {
      const slugForKey = rest.slug ?? id
      const ext = pickExt(file)
      const key = roomImageKey(slugForKey, 'gallery', ext)
      const result = await uploadImageToR2(file, key)
      newGalleryKeys.push(result.key)
    }
  } catch (e) {
    if (e instanceof R2UploadError) return { ok: false, error: e.message }
    return actionFail(e, 'Image upload failed')
  }

  // Compute final hero + gallery atomically.
  // Hero logic:
  //   1. If user uploaded a new hero file → use it.
  //   2. Else if user marked hero for delete (in deleteKeys) → promote first remaining gallery item.
  //   3. Else → keep existing hero.
  const heroMarkedForDelete = existingHeroKey.length > 0 && deleteKeys.includes(existingHeroKey)

  let finalHero: string
  if (newHeroKeys.length > 0) {
    finalHero = newHeroKeys[0]
  } else if (heroMarkedForDelete) {
    const remaining = existingGalleryKeys.filter((k) => !deleteKeys.includes(k))
    if (remaining.length === 0) {
      return {
        ok: false,
        error: 'ไม่สามารถลบ hero ได้ — ต้องมีรูปในระบบอย่างน้อย 1 รูป (อัปโหลดรูปใหม่ก่อน)',
      }
    }
    finalHero = remaining[0]
  } else {
    finalHero = existingHeroKey
  }

  // Gallery logic: keep non-deleted existing keys, then append new uploads.
  const finalGallery: string[] = [
    ...existingGalleryKeys.filter((k) => !deleteKeys.includes(k)),
    ...newGalleryKeys,
  ]

  // If neither hero nor gallery has anything after edits, the column
  // NOT NULL constraint would reject. Reject early with a clear message.
  if (!finalHero) {
    return {
      ok: false,
      error: 'ต้องมี hero อย่างน้อย 1 รูป (อัปโหลดรูปใหม่ก่อน)',
    }
  }

  const patch: Partial<Omit<typeof rest, never>> & {
    hero_image_key: string
    gallery_keys: string[]
  } = { ...rest, hero_image_key: finalHero, gallery_keys: finalGallery }

  try {
    await updateRoomType({ id, patch })
  } catch (e) {
    return actionFail(e, 'Could not update room type')
  }

  // Best-effort R2 cleanup AFTER DB success. If a delete fails, the DB row
  // is still consistent — orphan R2 files can be cleaned by a periodic job.
  for (const key of deleteKeys) {
    try {
      await deleteObjectFromR2(key)
    } catch (e) {
      console.warn(`[updateRoomTypeAction] R2 delete failed for key ${key}:`, e)
    }
  }

  revalidatePath('/admin/rates/room-types')
  revalidatePath(`/admin/rates/room-types/${id}/edit`)
  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  revalidatePath('/rooms')
  return { ok: true }
}

// =====================================================
// Seasonal rate actions
// =====================================================

const seasonalRateSchema = z
  .object({
    room_type_id: z.string().min(1),
    label: z.string().min(1).max(120),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    flat_price: z.number().positive().nullable(),
    price_multiplier: z.number().positive().nullable(),
    min_nights_override: z.number().int().min(1).max(60).nullable(),
    is_active: z.boolean(),
    priority: z.number().int().min(0).max(1000),
  })
  .refine(
    (data) => data.flat_price !== null || data.price_multiplier !== null,
    { message: 'Either flat_price or price_multiplier must be set' },
  )
  .refine((data) => data.start_date <= data.end_date, {
    message: 'start_date must be on or before end_date',
  })

function parseOptionalNum(raw: string | null): number | null {
  if (raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export async function createSeasonalRateAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/rates')

  const candidate = {
    room_type_id: String(formData.get('room_type_id') ?? '').trim(),
    label: String(formData.get('label') ?? '').trim(),
    start_date: String(formData.get('start_date') ?? '').trim(),
    end_date: String(formData.get('end_date') ?? '').trim(),
    flat_price: parseOptionalNum(String(formData.get('flat_price') ?? '')),
    price_multiplier: parseOptionalNum(String(formData.get('price_multiplier') ?? '')),
    min_nights_override: parseOptionalNum(String(formData.get('min_nights_override') ?? '')),
    is_active: formData.get('is_active') === 'true',
    priority: Number(formData.get('priority') ?? 0),
  }

  const parsed = seasonalRateSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  try {
    await createSeasonalRate(parsed.data)
  } catch (e) {
    return actionFail(e, 'Could not create seasonal rate')
  }

  revalidatePath('/admin/promotions')
  revalidatePath('/manager/rates')
  return { ok: true }
}
