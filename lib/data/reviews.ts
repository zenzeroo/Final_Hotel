import * as mock from './mock-reviews'
import * as real from './supabase-reviews'

const useMock = process.env.USE_MOCK_DATA === '1' || process.env.USE_MOCK_DATA === 'true'

export const getApprovedRoomReviews = useMock ? mock.getApprovedRoomReviews : real.getApprovedRoomReviews
export const getReviewModerationQueue = useMock ? mock.getReviewModerationQueue : real.getReviewModerationQueue
export const createReview = useMock ? mock.createReview : real.createReview
export const moderateReview = useMock ? mock.moderateReview : real.moderateReview
export const hideReview = useMock ? mock.hideReview : real.hideReview
export const unhideReview = useMock ? mock.unhideReview : real.unhideReview
export const deleteReview = useMock ? mock.deleteReview : real.deleteReview
