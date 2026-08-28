'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import {
  createReview as createReviewData,
  moderateReview as moderateReviewData,
  hideReview as hideReviewData,
  unhideReview as unhideReviewData,
  deleteReview as deleteReviewData,
} from '@/lib/data/reviews'
import type { ActionResult } from './manager'
import { translateSupabaseError } from '@/lib/errors/translate'

// Role sets used by the action bodies below. Centralizing here keeps the
// `requireRole(...)` call sites readable.
const ANY_AUTH = ['user', 'reception', 'housekeeper', 'manager', 'admin'] as const
const MODERATOR_ROLES = ['manager', 'admin', 'reception'] as const

// ── Schemas ────────────────────────────────────────────────────────────────

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  body: z.string().max(2000).optional().nullable(),
})

const reviewIdSchema = z.object({
  reviewId: z.string().uuid(),
})

// ── Guest: create review ───────────────────────────────────────────────────

export interface CreateReviewInput {
  bookingId: string
  roomTypeId: string
  rating: number
  title?: string | null
  body?: string | null
}

export interface CreateReviewResponse {
  success?: boolean
  error?: string
  reviewId?: string
}

/**
 * Guest submits a review for a checked-out booking.
 * New reviews always start as status='pending' and require moderation.
 */
export async function createReviewAction(
  input: CreateReviewInput,
): Promise<CreateReviewResponse> {
  const parsed = createReviewSchema.safeParse({
    bookingId: input.bookingId,
    roomTypeId: input.roomTypeId,
    rating: input.rating,
    title: input.title ?? null,
    body: input.body ?? null,
  })
  if (!parsed.success) {
    return { error: 'ข้อมูลไม่ถูกต้อง' }
  }

  const session = await requireRole(ANY_AUTH)
  const title = parsed.data.title?.trim() || null
  const body = parsed.data.body?.trim() || null

  try {
    const result = await createReviewData({
      bookingId: parsed.data.bookingId,
      roomTypeId: parsed.data.roomTypeId,
      userId: session.id,
      guestName: session.fullName ?? session.email ?? 'Guest',
      rating: parsed.data.rating,
      title,
      body,
    })
    revalidatePath(`/bookings/${parsed.data.bookingId}`)
    revalidatePath('/rooms')
    return { success: true, reviewId: result.id }
  } catch (e) {
    return { error: translateSupabaseError(e instanceof Error ? e.message : null) }
  }
}

// ── Staff: approve / hide / unhide ─────────────────────────────────────────

export async function moderateReviewAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(MODERATOR_ROLES)

  const parsed = reviewIdSchema.safeParse({ reviewId: formData.get('reviewId') })
  if (!parsed.success) return { ok: false, error: 'ไม่พบรหัสรีวิวที่ถูกต้อง' }

  try {
    await moderateReviewData({
      reviewId: parsed.data.reviewId,
      moderatorLabel: session.id,
    })
  } catch (e) {
    return { ok: false, error: translateSupabaseError(e instanceof Error ? e.message : null) }
  }

  revalidatePath('/manager/reviews')
  revalidatePath('/rooms')
  return { ok: true }
}

export async function hideReviewAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(MODERATOR_ROLES)

  const parsed = reviewIdSchema.safeParse({ reviewId: formData.get('reviewId') })
  if (!parsed.success) return { ok: false, error: 'ไม่พบรหัสรีวิวที่ถูกต้อง' }

  try {
    await hideReviewData({
      reviewId: parsed.data.reviewId,
      moderatorLabel: session.id,
    })
  } catch (e) {
    return { ok: false, error: translateSupabaseError(e instanceof Error ? e.message : null) }
  }

  revalidatePath('/manager/reviews')
  revalidatePath('/rooms')
  return { ok: true }
}

export async function unhideReviewAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(MODERATOR_ROLES)

  const parsed = reviewIdSchema.safeParse({ reviewId: formData.get('reviewId') })
  if (!parsed.success) return { ok: false, error: 'ไม่พบรหัสรีวิวที่ถูกต้อง' }

  try {
    await unhideReviewData({
      reviewId: parsed.data.reviewId,
      moderatorLabel: session.id,
    })
  } catch (e) {
    return { ok: false, error: translateSupabaseError(e instanceof Error ? e.message : null) }
  }

  revalidatePath('/manager/reviews')
  revalidatePath('/rooms')
  return { ok: true }
}

// ── Admin: hard delete ─────────────────────────────────────────────────────

export async function deleteReviewAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin')

  const parsed = reviewIdSchema.safeParse({ reviewId: formData.get('reviewId') })
  if (!parsed.success) return { ok: false, error: 'ไม่พบรหัสรีวิวที่ถูกต้อง' }

  try {
    await deleteReviewData({ reviewId: parsed.data.reviewId })
  } catch (e) {
    return { ok: false, error: translateSupabaseError(e instanceof Error ? e.message : null) }
  }

  revalidatePath('/manager/reviews')
  revalidatePath('/rooms')
  return { ok: true }
}
