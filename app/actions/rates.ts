'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession } from '@/lib/supabase/getSession'
import { closeRoomUnit, reopenRoomUnit } from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

async function requireManager() {
  const session = await getSession()
  if (!session) redirect('/login?next=/manager/rates')
  if (session.role !== 'manager' && session.role !== 'admin') {
    redirect('/')
  }
  return session
}

const unitIdSchema = z.string().min(1).max(80)

export async function closeRoomAction(formData: FormData): Promise<ActionResult> {
  await requireManager()
  const rawId = String(formData.get('unitId') ?? '').trim()
  const parsed = unitIdSchema.safeParse(rawId)
  if (!parsed.success) return { ok: false, error: 'Missing or invalid room unit id' }
  try {
    await closeRoomUnit({ unitId: parsed.data })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not close room',
    }
  }
  revalidatePath('/manager/rates')
  return { ok: true }
}

export async function reopenRoomAction(formData: FormData): Promise<ActionResult> {
  await requireManager()
  const rawId = String(formData.get('unitId') ?? '').trim()
  const parsed = unitIdSchema.safeParse(rawId)
  if (!parsed.success) return { ok: false, error: 'Missing or invalid room unit id' }
  try {
    await reopenRoomUnit({ unitId: parsed.data })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reopen room',
    }
  }
  revalidatePath('/manager/rates')
  return { ok: true }
}
