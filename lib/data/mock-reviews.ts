/**
 * Mock implementation of the Reviews & Ratings data layer.
 * Mirrors the pattern from `mock-manager.ts` — JSON import + mutable state array.
 */
import type {
  PublicReview,
  ReviewForModeration,
  ReviewQueueData,
  ReviewStatus,
} from './types'
import mockData from '@/data/mock-reviews.json'

// JSON import widens string unions, so cast to the snake_case shape from the file.
interface MockReviewRow {
  id: string
  user_id: string
  user_full_name: string
  room_type_id: string
  room_type_name: string
  booking_id: string
  booking_code: string
  rating: number
  title: string | null
  body: string | null
  status: ReviewStatus
  created_at: string
  moderated_by: string | null
  moderated_at: string | null
}

const typed = mockData as unknown as { reviews: MockReviewRow[] }

// Avatar background classes — rotate through a known palette.
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

function pickAvatarClass(userId: string): string {
  const hash = [...userId].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_BG[hash % AVATAR_BG.length]
}

function toModeration(r: MockReviewRow): ReviewForModeration {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    guestName: r.user_full_name,
    guestInitials: initialsOf(r.user_full_name),
    avatarBgClass: pickAvatarClass(r.user_id),
    status: r.status,
    roomTypeId: r.room_type_id,
    roomTypeName: r.room_type_name,
    bookingId: r.booking_id,
    bookingCode: r.booking_code,
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

// In-memory mutable copy so moderation actions feel real during dev.
const state = {
  reviews: typed.reviews.map(toModeration),
}

export async function getApprovedRoomReviews(roomTypeId: string): Promise<PublicReview[]> {
  return state.reviews
    .filter((r) => r.roomTypeId === roomTypeId && r.status === 'approved')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(toPublic)
}

export async function getReviewModerationQueue(): Promise<ReviewQueueData> {
  const byStatus = (status: ReviewStatus) =>
    state.reviews
      .filter((r) => r.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

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

export interface CreateReviewArgs {
  bookingId: string
  roomTypeId: string
  userId: string
  guestName: string
  rating: number
  title?: string | null
  body?: string | null
}

export async function createReview(args: CreateReviewArgs): Promise<{ id: string }> {
  const id = `rev-${String(state.reviews.length + 1).padStart(3, '0')}`
  const now = new Date().toISOString()
  state.reviews.unshift({
    id,
    rating: args.rating,
    title: args.title ?? null,
    body: args.body ?? null,
    createdAt: now,
    guestName: args.guestName,
    guestInitials: initialsOf(args.guestName),
    avatarBgClass: pickAvatarClass(args.userId),
    status: 'pending',
    roomTypeId: args.roomTypeId,
    roomTypeName: '', // not used on the guest side; moderator queue joins room_type via dispatcher
    bookingId: args.bookingId,
    bookingCode: null,
    userId: args.userId,
    moderatedBy: null,
    moderatedAt: null,
  })
  return { id }
}

export interface ModerateArgs {
  reviewId: string
  moderatorLabel: string
}

async function setStatus(args: ModerateArgs, status: ReviewStatus): Promise<{ id: string }> {
  const idx = state.reviews.findIndex((r) => r.id === args.reviewId)
  if (idx === -1) throw new Error('Review not found')
  state.reviews[idx] = {
    ...state.reviews[idx],
    status,
    moderatedBy: args.moderatorLabel,
    moderatedAt: new Date().toISOString(),
  }
  return { id: args.reviewId }
}

export async function moderateReview(args: ModerateArgs): Promise<{ id: string }> {
  return setStatus(args, 'approved')
}

export async function hideReview(args: ModerateArgs): Promise<{ id: string }> {
  return setStatus(args, 'hidden')
}

export async function unhideReview(args: ModerateArgs): Promise<{ id: string }> {
  return setStatus(args, 'approved')
}

export async function deleteReview(args: { reviewId: string }): Promise<{ id: string }> {
  const before = state.reviews.length
  state.reviews = state.reviews.filter((r) => r.id !== args.reviewId)
  if (state.reviews.length === before) throw new Error('Review not found')
  return { id: args.reviewId }
}
