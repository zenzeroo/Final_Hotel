'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { closeRoomUnit, reopenRoomUnit } from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const unitIdSchema = z.string().min(1).max(80)

export async function closeRoomAction(formData: FormData): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager/rates')
  const rawId = String(formData.get('unitId') ?? '').trim()
  const parsed = unitIdSchema.safeParse(rawId)
  if (!parsed.success) return { ok: false, error: 'Missing or invalid room unit id' }
  try {
    await closeRoomUnit({ unitId: parsed.data })
  } catch (e) {
    return actionFail(e, 'Could not close room')
  }
  revalidatePath('/manager/rates')
  return { ok: true }
}

export async function reopenRoomAction(formData: FormData): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager/rates')
  const rawId = String(formData.get('unitId') ?? '').trim()
  const parsed = unitIdSchema.safeParse(rawId)
  if (!parsed.success) return { ok: false, error: 'Missing or invalid room unit id' }
  try {
    await reopenRoomUnit({ unitId: parsed.data })
  } catch (e) {
    return actionFail(e, 'Could not reopen room')
  }
  revalidatePath('/manager/rates')
  return { ok: true }
}
