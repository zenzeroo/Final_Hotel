'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  suspendCustomer,
  unsuspendCustomer,
} from '@/lib/data/supabase-account'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// =========================================================
// suspendCustomerAction
// =========================================================

const suspendSchema = z.object({
  customerId: z.string().uuid('Invalid customer id'),
  // Optional reason — stored in profiles.suspended_reason.
  reason: z
    .string()
    .max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function suspendCustomerAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/customers')

  const parsed = suspendSchema.safeParse({
    customerId: String(formData.get('customerId') ?? ''),
    reason: String(formData.get('reason') ?? '').trim(),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  // Self-protection: admin cannot suspend themselves. (Defense-in-depth —
  // UI also hides the button on own profile.)
  if (parsed.data.customerId === session.id) {
    return { ok: false, error: 'ไม่สามารถระงับบัญชีของตัวเองได้' }
  }

  try {
    await suspendCustomer({
      targetId: parsed.data.customerId,
      reason: parsed.data.reason ?? null,
    })

    // Audit row — matches the booking_events pattern used by check-in-out,
    // refund approval, payment confirmation, etc. booking_id is NULL
    // (column made nullable in migration 20260928).
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: null,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'customer_suspended',
      description: parsed.data.reason
        ? `Customer suspended — ${parsed.data.reason}`
        : 'Customer suspended',
      metadata: { target_customer_id: parsed.data.customerId },
    })

    revalidatePath('/admin/customers')
    revalidatePath(`/admin/customers/${parsed.data.customerId}`)
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถระงับบัญชีได้')
  }
}

// =========================================================
// unsuspendCustomerAction
// =========================================================

const unsuspendSchema = z.object({
  customerId: z.string().uuid('Invalid customer id'),
})

export async function unsuspendCustomerAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/customers')

  const parsed = unsuspendSchema.safeParse({
    customerId: String(formData.get('customerId') ?? ''),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  if (parsed.data.customerId === session.id) {
    return { ok: false, error: 'ไม่สามารถปลดการระงับบัญชีของตัวเองได้' }
  }

  try {
    await unsuspendCustomer({ targetId: parsed.data.customerId })

    // Audit row.
    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: null,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'customer_unsuspended',
      description: 'Customer unsuspended',
      metadata: { target_customer_id: parsed.data.customerId },
    })

    revalidatePath('/admin/customers')
    revalidatePath(`/admin/customers/${parsed.data.customerId}`)
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถปลดการระงับได้')
  }
}
