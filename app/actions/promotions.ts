'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession } from '@/lib/supabase/getSession'
import { setPromotionActive } from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

async function requirePromotionManager() {
  const session = await getSession()
  if (!session) redirect('/login?next=/manager/promotions')
  // Promotion rights are intentionally restricted: manager + admin only.
  if (session.role !== 'manager' && session.role !== 'admin') {
    redirect('/')
  }
  return session
}

const promotionIdSchema = z.string().min(1).max(80)
const booleanSchema = z.preprocess((val) => {
  if (typeof val === 'string') return val === 'true'
  return val
}, z.boolean())

export async function togglePromotionAction(formData: FormData): Promise<ActionResult> {
  await requirePromotionManager()

  const rawId = String(formData.get('promotionId') ?? '').trim()
  const rawActive = formData.get('isActive')

  const idParsed = promotionIdSchema.safeParse(rawId)
  if (!idParsed.success) return { ok: false, error: 'Missing or invalid promotion id' }

  const activeParsed = booleanSchema.safeParse(rawActive)
  if (!activeParsed.success) return {
    ok: false,
    error: 'Missing or invalid isActive value',
  }

  try {
    await setPromotionActive({
      promotionId: idParsed.data,
      isActive: activeParsed.data,
    })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update promotion',
    }
  }

  revalidatePath('/manager/promotions')
  revalidatePath('/admin/promotions')
  return { ok: true }
}
