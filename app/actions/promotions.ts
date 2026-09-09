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
  min_nights: z.number().int().min(1).max(30),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active: z.boolean(),
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
  const normalized = { ...parsed.data, max_discount_amount: maxDiscount }
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

  try {
    await createPromotion(normalized)
  } catch (e) {
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
  const normalized = { ...parsed.data, max_discount_amount: maxDiscount }
  if (
    maxDiscount != null &&
    parsed.data.discount_type !== 'percent'
  ) {
    return {
      ok: false,
      error: 'ส่วนลดสูงสุดใช้ได้เฉพาะประเภทเปอร์เซ็นต์',
    }
  }

  try {
    await updatePromotion({ id, patch: normalized })
  } catch (e) {
    return actionFail(e, 'Could not update promotion')
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
