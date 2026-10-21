'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { RatingInput } from './RatingInput'
import { useT } from '@/lib/i18n/useT'
import { createReviewAction, type CreateReviewResponse } from '@/app/actions/reviews'

interface ReviewFormProps {
  bookingId: string
  roomTypeId: string
}

export function ReviewForm({ bookingId, roomTypeId }: ReviewFormProps) {
  const router = useRouter()
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<CreateReviewResponse | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rating < 1) {
      setState({ error: t('customer.review.pickRating') })
      return
    }
    startTransition(async () => {
      const result = await createReviewAction({
        bookingId,
        roomTypeId,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
      })
      if (result.error) {
        setState({ error: result.error })
        return
      }
      setState({ success: true, reviewId: result.reviewId })
      router.refresh()
    })
  }

  if (state?.success) {
    return (
      <div className="bg-secondary-container border border-secondary/30 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <MaterialIcon name="check_circle" size={28} className="text-secondary shrink-0" />
          <div>
            <h3 className="font-display text-lg text-on-secondary-container mb-1">
              {t('customer.review.thanksTitle')}
            </h3>
            <p className="text-body-md text-on-secondary-container">
              {t('customer.review.thanksBody')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
          {t('customer.review.yourRating')}
        </p>
        <RatingInput name="rating" value={rating} onChange={setRating} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
          {t('customer.review.titleLabel')}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={t('customer.review.titlePlaceholder')}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
          {t('customer.review.bodyLabel')}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t('customer.review.bodyPlaceholder')}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md resize-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </label>

      {state?.error ? (
        <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            {t('customer.review.sending')}
          </>
        ) : (
          <>
            <MaterialIcon name="send" size={18} />
            {t('customer.review.submit')}
          </>
        )}
      </button>

      <p className="text-caption text-on-surface-variant text-center">
        {t('customer.review.moderationNote')}
      </p>
    </form>
  )
}
