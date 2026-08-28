'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { updateHotelSettings } from '@/lib/data/manager'

export type ActionResult = { ok: true } | { ok: false; error: string }

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const settingsSchema = z.object({
  name: z.string().min(1).max(120),
  name_th: z.string().max(120).nullable(),
  address: z.string().min(1).max(500),
  phone: z.string().min(1).max(40),
  email: z.string().email(),
  tax_rate: z.number().min(0).max(1),
  resort_fee: z.number().min(0),
  currency: z.string().min(1).max(8),
  check_in_time: z.string().regex(TIME_REGEX),
  check_out_time: z.string().regex(TIME_REGEX),
  locale_default: z.string().min(1).max(8),
  hero_image_key: z.string().max(500).nullable(),
})

export async function updateHotelSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/settings')

  const optStr = (key: string): string | null => {
    const v = String(formData.get(key) ?? '').trim()
    return v === '' ? null : v
  }

  const candidate = {
    name: String(formData.get('name') ?? '').trim(),
    name_th: optStr('name_th'),
    address: String(formData.get('address') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    tax_rate: Number(formData.get('tax_rate') ?? 0),
    resort_fee: Number(formData.get('resort_fee') ?? 0),
    currency: String(formData.get('currency') ?? 'THB').trim(),
    check_in_time: String(formData.get('check_in_time') ?? '').trim(),
    check_out_time: String(formData.get('check_out_time') ?? '').trim(),
    locale_default: String(formData.get('locale_default') ?? 'th').trim(),
    hero_image_key: optStr('hero_image_key'),
  }

  const parsed = settingsSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  try {
    await updateHotelSettings({
      ...parsed.data,
      updated_by: session.id,
    })
  } catch (e) {
    return actionFail(e, 'Could not update hotel settings')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/manager/settings')
  return { ok: true }
}
