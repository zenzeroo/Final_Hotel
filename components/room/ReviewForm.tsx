'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { RatingInput } from './RatingInput'
import { createReviewAction, type CreateReviewResponse } from '@/app/actions/reviews'

interface ReviewFormProps {
  bookingId: string
  roomTypeId: string
}

export function ReviewForm({ bookingId, roomTypeId }: ReviewFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<CreateReviewResponse | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rating < 1) {
      setState({ error: 'กรุณาเลือกคะแนนอย่างน้อย 1 ดาว' })
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
              ขอบคุณสำหรับรีวิวของคุณ
            </h3>
            <p className="text-body-md text-on-secondary-container">
              รีวิวของคุณถูกส่งเรียบร้อยแล้ว และอยู่ในขั้นตอนรอการอนุมัติจากทีมงาน
              เมื่อผ่านการตรวจสอบจะปรากฏในหน้าห้องพัก
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
          คะแนนของคุณ
        </p>
        <RatingInput name="rating" value={rating} onChange={setRating} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
          หัวข้อ (ไม่บังคับ)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="เช่น การพักผ่อนที่น่าจดจำ"
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
          รายละเอียด (ไม่บังคับ)
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="แบ่งปันประสบการณ์ของคุณกับผู้เข้าพักท่านอื่น..."
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
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-secondary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
      >
        {pending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            กำลังส่ง…
          </>
        ) : (
          <>
            <MaterialIcon name="send" size={18} />
            ส่งรีวิว
          </>
        )}
      </button>

      <p className="text-caption text-on-surface-variant text-center">
        รีวิวจะปรากฏบนหน้าห้องพักหลังจากทีมงานตรวจสอบเรียบร้อย
      </p>
    </form>
  )
}
