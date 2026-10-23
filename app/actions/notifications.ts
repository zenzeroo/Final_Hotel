'use server'

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/ids'

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Phase 60 — mark notifications read. Runs as the signed-in user, so RLS
 * limits it to their own rows (and the column grant to read_at only).
 */
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'Invalid notification id' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  return error ? { ok: false, error: error.message } : { ok: true }
}
