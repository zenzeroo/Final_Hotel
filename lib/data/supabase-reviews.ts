/**
 * Supabase implementation of Reviews & Ratings data layer.
 * Stub — Phase 1 uses mock data. Real queries land in Phase 2.
 */

import type {
  PublicReview,
  ReviewForModeration,
  ReviewQueueData,
} from './types'

// TODO(phase-2): replace with real Supabase queries + RLS-enforced reads.

export async function getApprovedRoomReviews(_roomTypeId: string): Promise<PublicReview[]> {
  return []
}

export async function getReviewModerationQueue(): Promise<ReviewQueueData> {
  return {
    pending: [],
    approved: [],
    hidden: [],
    pendingCount: 0,
    approvedCount: 0,
    hiddenCount: 0,
  }
}

export async function createReview(_args: {
  bookingId: string
  roomTypeId: string
  userId: string
  guestName: string
  rating: number
  title?: string | null
  body?: string | null
}): Promise<{ id: string }> {
  throw new Error('createReview not implemented in supabase-reviews (Phase 2)')
}

export async function moderateReview(_args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  throw new Error('moderateReview not implemented in supabase-reviews (Phase 2)')
}

export async function hideReview(_args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  throw new Error('hideReview not implemented in supabase-reviews (Phase 2)')
}

export async function unhideReview(_args: {
  reviewId: string
  moderatorLabel: string
}): Promise<{ id: string }> {
  throw new Error('unhideReview not implemented in supabase-reviews (Phase 2)')
}

export async function deleteReview(_args: { reviewId: string }): Promise<{ id: string }> {
  throw new Error('deleteReview not implemented in supabase-reviews (Phase 2)')
}
