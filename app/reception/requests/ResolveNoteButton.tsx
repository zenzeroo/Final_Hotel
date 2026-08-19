'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface ResolveNoteButtonProps {
  noteId: string
}

export function ResolveNoteButton({ noteId }: ResolveNoteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { error } = await supabase
        .from('guest_notes')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', noteId)

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
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-secondary text-caption font-semibold uppercase tracking-wider hover:bg-primary-container transition-colors disabled:opacity-60"
    >
      {isPending ? (
        <span className="inline-block w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      ) : (
        <MaterialIcon name="check" size={14} />
      )}
      ปิดงาน
    </button>
  )
}
