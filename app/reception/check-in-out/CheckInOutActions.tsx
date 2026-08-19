'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface CheckInOutActionsProps {
  bookingId: string
  action: 'check_in' | 'check_out'
  label: string
}

export function CheckInOutActions({ bookingId, action, label }: CheckInOutActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = async () => {
    startTransition(async () => {
      // Direct Supabase client update (faster than server action for staff workflow)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const newStatus = action === 'check_in' ? 'checked_in' : 'checked_out'

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)

      if (error) {
        alert('ไม่สามารถอัปเดต: ' + error.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-secondary text-caption font-semibold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {isPending ? (
        <span className="inline-block w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      ) : (
        <MaterialIcon name={action === 'check_in' ? 'login' : 'logout'} size={14} />
      )}
      {label}
    </button>
  )
}
