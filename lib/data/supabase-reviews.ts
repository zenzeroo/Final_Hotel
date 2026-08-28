/**
 * Supabase implementation of the Reviews & Ratings data layer.
 *
 * Avatar background classes and initials are derived in JS to keep parity
 * with the mock layer's shape (modulo slight palette differences).
 */

import { wrapSupabaseError } from '@/lib/errors/supabase'

import type {
  PublicReview,
  ReviewForModeration,
  ReviewQueueData,
  ReviewStatus,
} from './types'

// =========================================================
// Shape helpers — mirror mock-reviews.ts
// =========================================================

const AVATAR_BG = [
  'bg-primary text-secondary',
  'bg-secondary text-secondary-container',
  'bg-tertiary text-on-tertiary',
  'bg-primary-container text-primary',
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function pickAvatarClass(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) | 0
  return AVATAR_BG[Math.abs(hash) % AVATAR_BG.length]!
}

// DB row shape returned by PostgREST for review queries.
type ReviewRow = {
  id: string
  rating: number
  title: string | null
  body: string | null
  status: ReviewStatus
  created_at: string
  moderated_by: string | null
  moderated_at: string | null
  user_id: string
  room_type_id: string
  booking_id: string | null
  // Embedded relations — Supabase may return them as either object or array.
  user: { full_name: string | null } | { full_name: string | null }[] | null
  room_type: { name: string } | { name: string }[] | null
  booking: { booking_code: string } | { booking_code: string }[] | null
}

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function toModeration(r: ReviewRow): ReviewForModeration {
  const user = asObject(r.user)
  const roomType = asObject(r.room_type)
  const booking = asObject(r.booking)
  const guestName = user?.full_name ?? 'Guest'
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    guestName,
    guestInitials: initialsOf(guestName),
    avatarBgClass: pickAvatarClass(r.user_id),
    status: r.status,
    roomTypeId: r.room_type_id,
    roomTypeName: roomType?.name ?? '',
    bookingId: r.booking_id,
    bookingCode: booking?.booking_code ?? null,
    userId: r.user_id,
    moderatedBy: r.moderated_by,
    moderatedAt: r.moderated_at,
  }
}

function toPublic(r: ReviewForModeration): PublicReview {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
    guestName: r.guestName,
    guestInitials: r.guestInitials,
    avatarBgClass: r.avatarBgClass,
  }
}

const REVIEW_SELECT = `
  id, rating, title, body, status, created_at,
  moderated_by, moderated_at,
  user_id, room_type_id, booking_id,
  user:profiles!reviews_user_id_fkey(full_name),
  room_type:room_types(name),
  booking:bookings(booking_code)
`

// =========================================================
// Reads
// =========================================================

export async function getApprovedRoomReviews(roomTypeId: string): Promise<PublicReview[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('room_type_id', roomTypeId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) wrapSupabaseError('', error)
  return (data ?? []).map((r) => toModeration(r as unknown as ReviewRow)).map(toPublic)
}

export async function getReviewModerationQueue(): Promise<ReviewQueueData> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // Single SELECT — group by status in JS. Cheaper than 3 round-trips and
  // the result set is small (mod queue is typically < 50 rows).
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .order('created_at', { ascending: false })
  if (error) wrapSupabaseError('', error)
  const rows = (data ?? []).map((r) => toModeration(r as unknown as ReviewRow))
  const byStatus = (status: ReviewStatus) =>
    rows.filter((r) => r.status === status).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  const pending = byStatus('pending')
  const approved = byStatus('approved')
  const hidden = byStatus('hidden')

  return {
    pending,
    approved,
    hidden,
    pendingCount: pending.length,
    approvedCount: approved.length,
    hiddenCount: hidden.length,
  }
}

// =========================================================
// Mutations
// =========================================================

export async function createReview(args: {
  bookingId: string
  roomTypeId: string
  userId: string
  guestName: string
  rating: number
  title?: string | null
  body?: string | null
}): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // RLS `review owner insert` enforces user_id = auth.uid(). We pass it
  // explicitly so the column matches auth.uid() (avoids a surprise default).
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      user_id: args.userId,
      room_type_id: args.roomTypeId,
      booking_id: args.bookingId,
      rating: args.rating,
      title: args.title ?? null,
      body: args.body ?? null,
      // status defaults to 'pending' per column DEFAULT.
    })
    .select('id')
    .single()
  if (error) wrapSupabaseError('', error)
  return { id: data.id }
}

async function setReviewStatus(args: {
  reviewId: string
  moderatorLabel: string
  status: ReviewStatus
}): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // The moderatorLabel passed in by the action layer is the staff session's
  // email / fullName / id. We need a UUID for the FK (moderated_by → profiles).
  // The action layer already passes session.id (UUID) post-9B refactor —
  // but we accept either form and try to parse it as a UUID first.
  const moderatorUuid = isUuid(args.moderatorLabel)
    ? args.moderatorLabel
    : null
  const patch: Record<string, unknown> = {
    status: args.status,
    moderated_at: new Date().toISOString(),
  }
  if (moderatorUuid) patch.moderated_by = moderatorUuid
  const { error } = await supabase.from('reviews').update(patch).eq('id', args.reviewId)
  if (error) wrapSupabaseError('', error)
  return { id: args.reviewId }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

export async function moderateReview(args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  return setReviewStatus({ ...args, status: 'approved' })
}

export async function hideReview(args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  return setReviewStatus({ ...args, status: 'hidden' })
}

export async function unhideReview(args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  // 'unhide' moves a hidden review back to approved.
  return setReviewStatus({ ...args, status: 'approved' })
}

export async function deleteReview(args: { reviewId: string }): Promise<{ id: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  // RLS `review admin delete` restricts to admin only.
  const { error } = await supabase.from('reviews').delete().eq('id', args.reviewId)
  if (error) wrapSupabaseError('', error)
  return { id: args.reviewId }
}
