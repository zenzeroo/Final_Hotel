'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession, roleHomePath } from '@/lib/supabase/getSession'
import { createRoomType, updateRoomType, listRoomTypes } from '@/lib/data/rooms'
import {
  createSeasonalRate,
  updateSeasonalRate,
  deleteSeasonalRate,
} from '@/lib/data/manager'

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireAdminRates() {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin/rates')
  if (session.role !== 'admin') redirect(roleHomePath(session.role))
  return session
}

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

export async function createRoomTypeAction(formData: FormData): Promise<ActionResult> {
  await requireAdminRates()

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

  // bed_type, floor, type, view_label, hero_image_key, gallery_keys, amenities
  // default to reasonable stubs since the admin form doesn't expose them yet.
  const existing = await listRoomTypes()
  const createArgs = {
    ...parsed.data,
    bed_type: 'King' as const,
    floor: existing.length > 0 ? Math.max(...existing.map((r) => r.floor)) + 1 : 1,
    type: 'Deluxe' as const,
    hero_image_key: '',
    gallery_keys: [] as string[],
    amenities: [] as string[],
    rating_avg: 0,
    rating_count: 0,
  }

  try {
    await createRoomType(createArgs)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not create room type',
    }
  }

  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  revalidatePath('/rooms')
  return { ok: true }
}

const roomTypeUpdateSchema = roomTypeSchema.partial().extend({ id: z.string().min(1) })

export async function updateRoomTypeAction(formData: FormData): Promise<ActionResult> {
  await requireAdminRates()

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

  const { id, ...patch } = parsed.data
  try {
    await updateRoomType({ id, patch })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update room type',
    }
  }

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
  await requireAdminRates()

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
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not create seasonal rate',
    }
  }

  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  return { ok: true }
}

export async function updateSeasonalRateAction(formData: FormData): Promise<ActionResult> {
  await requireAdminRates()

  const baseCandidate = {
    id: String(formData.get('id') ?? '').trim(),
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

  const idSchema = z.object({ id: z.string().min(1) })
  const idParsed = idSchema.safeParse({ id: baseCandidate.id })
  if (!idParsed.success) return { ok: false, error: 'Missing seasonal rate id' }

  const parsed = seasonalRateSchema.safeParse(baseCandidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  try {
    await updateSeasonalRate({ id: idParsed.data.id, patch: parsed.data })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update seasonal rate',
    }
  }

  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  return { ok: true }
}

export async function deleteSeasonalRateAction(formData: FormData): Promise<ActionResult> {
  await requireAdminRates()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Missing seasonal rate id' }

  try {
    await deleteSeasonalRate({ id })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not delete seasonal rate',
    }
  }

  revalidatePath('/admin/rates')
  revalidatePath('/manager/rates')
  return { ok: true }
}
