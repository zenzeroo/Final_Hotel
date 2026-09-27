'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import {
  appendHeroSlide,
  setHeroSlideActive,
  deleteHeroSlide,
  moveHeroSlide,
  updateHeroSlideCaption,
  listAllHeroSlides,
} from '@/lib/data/manager'
import {
  uploadImageToR2,
  pickExt,
  R2UploadError,
} from '@/lib/r2/upload'
import { deleteObjectFromR2 } from '@/lib/r2/delete'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// =====================================================
// Phase 43 — Admin hero carousel actions
// =====================================================

/**
 * Generate an R2 object key for a custom hero slide image.
 * Path: `hero/custom/<timestamp>-<random>.<ext>` — avoids filename collisions
 * + keeps it sorted by upload time (admin can locate by prefix).
 */
function customHeroImageKey(ext: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `hero/custom/${ts}-${rand}.${ext}`
}

const addRoomTypeSlideSchema = z.object({
  roomTypeId: z.string().uuid(),
})

const addPromotionSlideSchema = z.object({
  promotionId: z.string().uuid(),
})

const addCustomSlideSchema = z.object({
  customImage: z.instanceof(File).refine((f) => f.size > 0 && f.type.length > 0, {
    message: 'กรุณาเลือกไฟล์รูปภาพ',
  }),
  customCaption: z.string().max(500).optional().nullable(),
  customCaptionTh: z.string().max(500).optional().nullable(),
})

const moveSlideSchema = z.object({
  slideId: z.string().uuid(),
  direction: z.enum(['up', 'down']),
})

const toggleSlideSchema = z.object({
  slideId: z.string().uuid(),
  isActive: z.boolean(),
})

const captionSlideSchema = z.object({
  slideId: z.string().uuid(),
  customCaption: z.string().max(500).nullable(),
  customCaptionTh: z.string().max(500).nullable(),
})

/**
 * Add a slide that uses an existing room_type's hero_image_key.
 * Admin clicks "จากห้องพัก" tab → picks a room → this action runs.
 */
export async function addHeroSlideFromRoomTypeAction(
  input: z.infer<typeof addRoomTypeSlideSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole('admin', '/admin/hero-carousel')
  const parsed = addRoomTypeSlideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }
  try {
    const result = await appendHeroSlide({
      sourceType: 'room_type',
      roomTypeId: parsed.data.roomTypeId,
      updatedBy: session.id,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/') // public homepage re-fetches
    return { ok: true, data: result }
  } catch (e) {
    return actionFail(e, 'Could not add hero slide')
  }
}

/**
 * Add a slide that uses an existing promotion's image_key.
 * Admin clicks "จากโปรโมชั่น" tab → picks a promotion → this action runs.
 */
export async function addHeroSlideFromPromotionAction(
  input: z.infer<typeof addPromotionSlideSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole('admin', '/admin/hero-carousel')
  const parsed = addPromotionSlideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }
  try {
    const result = await appendHeroSlide({
      sourceType: 'promotion',
      promotionId: parsed.data.promotionId,
      updatedBy: session.id,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/')
    return { ok: true, data: result }
  } catch (e) {
    return actionFail(e, 'Could not add hero slide')
  }
}

/**
 * Add a slide with a custom-uploaded image + optional caption (TH/EN).
 * Admin clicks "อัปโหลดเอง" tab → picks a file + fills caption → this action
 * uploads to R2 server-side then inserts the row.
 */
export async function addHeroSlideCustomAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole('admin', '/admin/hero-carousel')

  const candidate = {
    customImage: formData.get('customImage'),
    customCaption: (() => {
      const v = String(formData.get('customCaption') ?? '').trim()
      return v === '' ? null : v
    })(),
    customCaptionTh: (() => {
      const v = String(formData.get('customCaptionTh') ?? '').trim()
      return v === '' ? null : v
    })(),
  }
  const parsed = addCustomSlideSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }

  let customImageKey: string
  try {
    const ext = pickExt(parsed.data.customImage)
    const key = customHeroImageKey(ext)
    const result = await uploadImageToR2(parsed.data.customImage, key)
    customImageKey = result.key
  } catch (e) {
    if (e instanceof R2UploadError) return { ok: false, error: e.message }
    return actionFail(e, 'Image upload failed')
  }

  try {
    const result = await appendHeroSlide({
      sourceType: 'custom',
      customImageKey,
      customCaption: parsed.data.customCaption ?? undefined,
      customCaptionTh: parsed.data.customCaptionTh ?? undefined,
      updatedBy: session.id,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/')
    return { ok: true, data: result }
  } catch (e) {
    // Roll back the uploaded R2 file — leave no orphan objects.
    await deleteObjectFromR2(customImageKey).catch(() => undefined)
    return actionFail(e, 'Could not add hero slide')
  }
}

/**
 * Remove a slide. For `custom` slides also delete the R2 object.
 */
export async function removeHeroSlideAction(
  slideId: string,
): Promise<ActionResult> {
  await requireRole('admin', '/admin/hero-carousel')
  if (!z.string().uuid().safeParse(slideId).success) {
    return { ok: false, error: 'slideId ไม่ถูกต้อง' }
  }

  // Fetch the slide first to know if it's custom (for R2 cleanup).
  const all = await listAllHeroSlides()
  const slide = all.find((s) => s.id === slideId)
  if (!slide) return { ok: false, error: 'ไม่พบสไลด์' }

  try {
    await deleteHeroSlide({ slideId })
  } catch (e) {
    return actionFail(e, 'Could not remove hero slide')
  }

  // Best-effort R2 cleanup for custom slides.
  if (slide.source_type === 'custom' && slide.custom_image_key) {
    await deleteObjectFromR2(slide.custom_image_key).catch(() => undefined)
  }

  revalidatePath('/admin/hero-carousel')
  revalidatePath('/')
  return { ok: true }
}

/**
 * Toggle the is_active flag.
 */
export async function toggleHeroSlideActiveAction(
  input: z.infer<typeof toggleSlideSchema>,
): Promise<ActionResult> {
  await requireRole('admin', '/admin/hero-carousel')
  const parsed = toggleSlideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }
  try {
    await setHeroSlideActive({
      slideId: parsed.data.slideId,
      isActive: parsed.data.isActive,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'Could not toggle hero slide')
  }
}

/**
 * Move a slide up or down in display_order. Atomic via the
 * `move_hero_slide` RPC — no client-side sort needed.
 */
export async function moveHeroSlideAction(
  input: z.infer<typeof moveSlideSchema>,
): Promise<ActionResult> {
  await requireRole('admin', '/admin/hero-carousel')
  const parsed = moveSlideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }
  try {
    await moveHeroSlide({
      slideId: parsed.data.slideId,
      direction: parsed.data.direction,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'Could not move hero slide')
  }
}

/**
 * Update a custom slide's caption (TH + EN). Called from the admin edit
 * modal (future enhancement — initial release doesn't expose this in the
 * UI; left as a server action for parity with PromotionForm pattern).
 */
export async function updateHeroSlideCaptionAction(
  input: z.infer<typeof captionSlideSchema>,
): Promise<ActionResult> {
  await requireRole('admin', '/admin/hero-carousel')
  const parsed = captionSlideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }
  try {
    await updateHeroSlideCaption({
      slideId: parsed.data.slideId,
      customCaption: parsed.data.customCaption,
      customCaptionTh: parsed.data.customCaptionTh,
    })
    revalidatePath('/admin/hero-carousel')
    revalidatePath('/')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'Could not update hero slide caption')
  }
}
