'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'

interface ResolveNoteButtonProps {
  noteId: string
}

export function ResolveNoteButton({ noteId }: ResolveNoteButtonProps) {
  const t = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const handleClick = () => {
    startTransition(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { error } = await supabase
        .from('guest_notes')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', noteId)

      if (error) {
        toast.error(t('reception.common.updateFailed', { detail: error.message }))
        return
      }

      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary text-caption font-semibold uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
      >
        {isPending ? (
          <span className="inline-block w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        ) : (
          <MaterialIcon name="check" size={14} />
        )}
        {t('reception.requestsPage.close')}
      </button>
    </>
  )
}
