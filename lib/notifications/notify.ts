/**
 * Phase 60 — write in-app notifications (server only).
 *
 * Same contract as sendEmail(): call it after the main change succeeded; it
 * never throws, so a notification failure can't undo the action. Uses the
 * admin client because the recipient is usually not the person acting.
 * `eventKey` is UNIQUE in the table → retries and webhook re-deliveries are
 * no-ops.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationParams, NotificationType } from './types'

type UserRole = 'user' | 'reception' | 'housekeeper' | 'manager' | 'admin'

export interface NotifyInput {
  type: NotificationType
  params?: NotificationParams
  link?: string | null
  bookingId?: string | null
  eventKey: string
}

type Row = {
  user_id: string
  type: NotificationType
  params: NotificationParams
  link: string | null
  booking_id: string | null
  event_key: string
}

async function insertRows(rows: Row[]): Promise<void> {
  if (rows.length === 0) return
  try {
    const admin = await createAdminClient()
    const { error } = await admin
      .from('notifications')
      .upsert(rows, { onConflict: 'event_key', ignoreDuplicates: true })
    if (error) console.error('[notify] insert failed:', error.message)
  } catch (e) {
    console.error('[notify] failed:', e instanceof Error ? e.message : e)
  }
}

function toRow(userId: string, input: NotifyInput, eventKey: string): Row {
  return {
    user_id: userId,
    type: input.type,
    params: input.params ?? {},
    link: input.link ?? null,
    booking_id: input.bookingId ?? null,
    event_key: eventKey,
  }
}

/** Notify one user (guest or a specific staff member). */
export async function notifyUser(userId: string | null | undefined, input: NotifyInput): Promise<void> {
  if (!userId) return
  await insertRows([toRow(userId, input, input.eventKey)])
}

/**
 * Notify every active staff member with one of `roles`. `link` may depend on
 * the recipient's role (e.g. manager vs reception maintenance page).
 */
export async function notifyRoles(
  roles: UserRole[],
  input: Omit<NotifyInput, 'link'> & { link?: string | ((role: UserRole) => string) },
): Promise<void> {
  try {
    const admin = await createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .in('role', roles)
      .eq('is_active', true)
    if (error) {
      console.error('[notify] recipient lookup failed:', error.message)
      return
    }
    const rows = (data ?? []).map((p) => {
      const role = p.role as UserRole
      const link = typeof input.link === 'function' ? input.link(role) : input.link
      return toRow(p.id as string, { ...input, link }, `${input.eventKey}:${p.id}`)
    })
    await insertRows(rows)
  } catch (e) {
    console.error('[notify] failed:', e instanceof Error ? e.message : e)
  }
}
