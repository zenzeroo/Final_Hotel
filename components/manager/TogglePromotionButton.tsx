'use client'

import { useTransition } from 'react'
import { togglePromotionAction } from '@/app/actions/promotions'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface TogglePromotionButtonProps {
  promotionId: string
  isActive: boolean
}

export function TogglePromotionButton({ promotionId, isActive }: TogglePromotionButtonProps) {
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await togglePromotionAction(fd)
        })
      }
    >
      <input type="hidden" name="promotionId" value={promotionId} />
      <input type="hidden" name="isActive" value={(!isActive).toString()} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-caption font-semibold transition-colors disabled:opacity-50 ${
          isActive
            ? 'bg-primary text-on-primary hover:bg-primary-fixed hover:text-primary'
            : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-fixed hover:text-primary'
        }`}
        title={isActive ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
      >
        <MaterialIcon
          name={isActive ? 'toggle_on' : 'toggle_off'}
          size={16}
          filled={isActive}
        />
        {pending ? '...' : isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
      </button>
    </form>
  )
}
