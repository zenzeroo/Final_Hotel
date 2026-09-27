'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import {
  setPromotionActive,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '@/lib/data/manager'
import {
  uploadImageToR2,
  pickExt,
  R2UploadError,
} from '@/lib/r2/upload'
import { deleteObjectFromR2 } from '@/lib/r2/delete'

/**
 * Phase 43 — Generate an R2 object key for a promotion hero image.
 * Path: `promotions/<timestamp>-<random>.<ext>` — sorted by upload time.
 */
function promotionImageKey(ext: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `promotions/${ts}-${rand}.${ext}`
}

/**
 * Resolve the effective image_key for a promotion update:
 *   1. If a new file was uploaded (image_file), upload to R2 and return new key.
 *   2. If a hidden image_key string was passed (existing image preserved), return it.
 *   3. If "removeImage" checkbox is set, return null.
 *   4. If nothing sent, return undefined (no change).
 *
 * Returns: { imageKey: string | null | undefined, uploadedKey?: string }
 *   - imageKey = undefined → don't change (no update)
 *   - imageKey = null → clear the field
 *   - imageKey = string → set the field
 */
async function resolveImageKey(
  formData: FormData,
  previousKey: string | null,
): Promise<{ imageKey: string | null | undefined; uploadedKey?: string }> {
  const file = formData.get('image_file')
  if (file instanceof File && file.size > 0 && file.type.length > 0) {
    // New upload — fire-and-forget R2 PUT.
    const ext = pickExt(file)
    const key = promotionImageKey(ext)
    const result = await uploadImageToR2(file, key)
    return { imageKey: result.key, uploadedKey: previousKey ?? undefined }
  }

  // Existing image preserved?
  const existingKey = String(formData.get('image_key') ?? '').trim()
  if (existingKey) return { imageKey: existingKey }

  // Explicit removal?
  const remove = formData.get('removeImage') === 'true'
  if (remove) return { imageKey: null }

  // No change at all (e.g. update without touching the image).
  return { imageKey: undefined }
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const promotionIdSchema = z.string().min(1).max(80)
const booleanSchema = z.preprocess((val) => {
  if (typeof val === 'string') return val === 'true'
  return val
}, z.boolean())

export async function togglePromotionAction(formData: FormData): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager/promotions')

  const rawId = String(formData.get('promotionId') ?? '').trim()
  const rawActive = formData.get('isActive')

  const idParsed = promotionIdSchema.safeParse(rawId)
  if (!idParsed.success) return { ok: false, error: 'Missing or invalid promotion id' }

  const activeParsed = booleanSchema.safeParse(rawActive)
  if (!activeParsed.success) return {
    ok: false,
    error: 'Missing or invalid isActive value',
  }

  try {
    await setPromotionActive({
      promotionId: idParsed.data,
      isActive: activeParsed.data,
    })
  } catch (e) {
    return actionFail(e, 'Could not update promotion')
  }

  revalidatePath('/manager/promotions')
  revalidatePath('/admin/promotions')
  return { ok: true }
}

// =====================================================
// Phase 7 — Admin-only CRUD
// =====================================================

const promotionInputSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  discount_type: z.enum(['percent', 'flat']),
  discount_value: z.number().positive(),
  // Phase 27 — optional THB cap. NULL = no cap. Only valid for
  // discount_type='percent' (enforced in the action guard below).
  max_discount_amount: z.number().nonnegative().nullable().optional(),
  // Phase 27 — optional restrict-to room types. Empty array = all
  // room types (backwards-compatible). Filtered to the room_type_enum.
  applies_to_room_types: z
    .array(z.enum(['Deluxe', 'Suite', 'Villa']))
    .default([]),
  min_nights: z.number().int().min(1).max(30),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active: z.boolean(),
  // Phase 43 — optional R2 object key for the hero carousel. NULL = no
  // hero image (the carousel will skip this promotion in its picker).
  image_key: z.string().max(500).nullable().optional(),
})

export async function createPromotionAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/promotions')

  const rawDiscountValue = String(formData.get('discount_value') ?? '').trim()
  const rawMinNights = String(formData.get('min_nights') ?? '').trim()
  const rawMaxDiscount = String(formData.get('max_discount_amount') ?? '').trim()

  const candidate = {
    code: String(formData.get('code') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    description: (() => {
      const v = String(formData.get('description') ?? '').trim()
      return v === '' ? null : v
    })(),
    discount_type: String(formData.get('discount_type') ?? 'percent'),
    discount_value: Number(rawDiscountValue),
    max_discount_amount:
      rawMaxDiscount === '' ? null : Number(rawMaxDiscount),
    // Phase 43 — optional hero image. Empty string → null (no image).
    image_key: (() => {
      const v = String(formData.get('image_key') ?? '').trim()
      return v === '' ? null : v
    })(),
    // Phase 27 — getAll() returns every checked value; filter to enum.
    applies_to_room_types: formData
      .getAll('applies_to_room_types')
      .map(String)
      .filter((v): v is 'Deluxe' | 'Suite' | 'Villa' =>
        v === 'Deluxe' || v === 'Suite' || v === 'Villa',
      ),
    min_nights: Number(rawMinNights),
    valid_from: String(formData.get('valid_from') ?? '').trim(),
    valid_until: String(formData.get('valid_until') ?? '').trim(),
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = promotionInputSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid promotion input: ' + parsed.error.issues[0]?.message }
  }
  // zod .optional() leaves the field as `undefined` when omitted; coalesce
  // to `null` to match Promotion.max_discount_amount (number | null).
  const maxDiscount =
    parsed.data.max_discount_amount == null ? null : parsed.data.max_discount_amount
  // Phase 27 — same coalesce for applies_to_room_types ([] → null
  // means "applies to all room types" — no DB write needed).
  const appliesTo =
    parsed.data.applies_to_room_types && parsed.data.applies_to_room_types.length > 0
      ? parsed.data.applies_to_room_types
      : null
  const normalized = {
    ...parsed.data,
    max_discount_amount: maxDiscount,
    applies_to_room_types: appliesTo,
    // Phase 43 — zod .optional() leaves undefined when omitted; coalesce to null.
    image_key: parsed.data.image_key ?? null,
  }
  if (candidate.discount_type === 'percent' && parsed.data.discount_value > 100) {
    return { ok: false, error: 'Percent discount must be ≤ 100' }
  }
  if (
    maxDiscount != null &&
    parsed.data.discount_type !== 'percent'
  ) {
    return {
      ok: false,
      error: 'ส่วนลดสูงสุดใช้ได้เฉพาะประเภทเปอร์เซ็นต์',
    }
  }
  if (parsed.data.valid_from > parsed.data.valid_until) {
    return { ok: false, error: 'valid_from must be on or before valid_until' }
  }

  // Phase 43 — optional hero image upload (server-side R2 push). Failures
  // here abort the create so we never end up with a promotion pointing at
  // a half-uploaded file.
  let uploadedKey: string | null = null
  try {
    const resolved = await resolveImageKey(formData, null)
    if (resolved.imageKey !== undefined) {
      uploadedKey = resolved.imageKey ?? null
    }
  } catch (e) {
    if (e instanceof R2UploadError) return { ok: false, error: e.message }
    return actionFail(e, 'Image upload failed')
  }

  const normalizedWithImage = {
    ...normalized,
    image_key: uploadedKey,
  }

  try {
    await createPromotion(normalizedWithImage)
  } catch (e) {
    // Roll back the uploaded R2 file (best-effort) so we don't leak.
    if (uploadedKey) await deleteObjectFromR2(uploadedKey).catch(() => undefined)
    return actionFail(e, 'Could not create promotion')
  }

  revalidatePath('/admin/promotions')
  revalidatePath('/manager/promotions')
  return { ok: true }
}

export async function updatePromotionAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/promotions')

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Missing promotion id' }

  const rawDiscountValue = String(formData.get('discount_value') ?? '').trim()
  const rawMinNights = String(formData.get('min_nights') ?? '').trim()
  const rawMaxDiscount = String(formData.get('max_discount_amount') ?? '').trim()

  const candidate = {
    code: String(formData.get('code') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    description: (() => {
      const v = String(formData.get('description') ?? '').trim()
      return v === '' ? null : v
    })(),
    discount_type: String(formData.get('discount_type') ?? 'percent'),
    discount_value: Number(rawDiscountValue),
    max_discount_amount:
      rawMaxDiscount === '' ? null : Number(rawMaxDiscount),
    // Phase 43 — optional hero image. Empty string → null (no image).
    image_key: (() => {
      const v = String(formData.get('image_key') ?? '').trim()
      return v === '' ? null : v
    })(),
    // Phase 27 — getAll() returns every checked value; filter to enum.
    applies_to_room_types: formData
      .getAll('applies_to_room_types')
      .map(String)
      .filter((v): v is 'Deluxe' | 'Suite' | 'Villa' =>
        v === 'Deluxe' || v === 'Suite' || v === 'Villa',
      ),
    min_nights: Number(rawMinNights),
    valid_from: String(formData.get('valid_from') ?? '').trim(),
    valid_until: String(formData.get('valid_until') ?? '').trim(),
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = promotionInputSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid promotion input: ' + parsed.error.issues[0]?.message }
  }
  const maxDiscount =
    parsed.data.max_discount_amount == null ? null : parsed.data.max_discount_amount
  // Phase 27 — same coalesce for applies_to_room_types ([] → null
  // means "applies to all room types" — no DB write needed).
  const appliesTo =
    parsed.data.applies_to_room_types && parsed.data.applies_to_room_types.length > 0
      ? parsed.data.applies_to_room_types
      : null
  const normalized = {
    ...parsed.data,
    max_discount_amount: maxDiscount,
    applies_to_room_types: appliesTo,
    // Phase 43 — zod .optional() leaves undefined when omitted; coalesce to null.
    image_key: parsed.data.image_key ?? null,
  }
  if (
    maxDiscount != null &&
    parsed.data.discount_type !== 'percent'
  ) {
    return {
      ok: false,
      error: 'ส่วนลดสูงสุดใช้ได้เฉพาะประเภทเปอร์เซ็นต์',
    }
  }

  // Phase 43 — resolve image_key (upload, preserve, or clear).
  // Fetch existing key first so we can clean up the R2 file when replaced.
  const { getPromotionById } = await import('@/lib/data/manager')
  const existing = await getPromotionById(id)
  let uploadedKey: string | null | undefined
  try {
    const resolved = await resolveImageKey(formData, existing?.image_key ?? null)
    uploadedKey = resolved.imageKey
  } catch (e) {
    if (e instanceof R2UploadError) return { ok: false, error: e.message }
    return actionFail(e, 'Image upload failed')
  }

  // If we uploaded a new file and there was an old one, the old one becomes
  // orphaned once the DB update succeeds — clean it up best-effort.
  const oldKey = existing?.image_key ?? null
  const newKeyIsReplacement =
    uploadedKey !== undefined && uploadedKey !== null && uploadedKey !== oldKey

  const normalizedWithImage = {
    ...normalized,
    // Only include image_key in the patch if the user explicitly changed it
    // (uploaded, preserved, or cleared). Otherwise omit so the manager
    // wrapper doesn't touch the column.
    ...(uploadedKey !== undefined ? { image_key: uploadedKey } : {}),
  }

  try {
    await updatePromotion({ id, patch: normalizedWithImage })
  } catch (e) {
    // Roll back the uploaded R2 file so we don't leak.
    if (uploadedKey && newKeyIsReplacement) {
      await deleteObjectFromR2(uploadedKey).catch(() => undefined)
    }
    return actionFail(e, 'Could not update promotion')
  }

  // Cleanup the OLD R2 file (only when successfully replaced).
  if (newKeyIsReplacement && oldKey) {
    await deleteObjectFromR2(oldKey).catch(() => undefined)
  }

  revalidatePath('/admin/promotions')
  revalidatePath('/manager/promotions')
  return { ok: true }
}

export async function deletePromotionAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/promotions')

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Missing promotion id' }

  try {
    await deletePromotion({ id })
  } catch (e) {
    return actionFail(e, 'Could not delete promotion')
  }

  revalidatePath('/admin/promotions')
  revalidatePath('/manager/promotions')
  return { ok: true }
}
