'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  suspendCustomer,
  unsuspendCustomer,
  blacklistCustomer,
  unblacklistCustomer,
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

// =========================================================
// blacklistCustomerAction / unblacklistCustomerAction
// =========================================================
// Blacklisted customers can still sign in; the booking actions refuse
// them and notify reception (app/actions/booking.ts).

const blacklistSchema = z.object({
  customerId: z.string().uuid('Invalid customer id'),
  reason: z
    .string()
    .max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function blacklistCustomerAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/customers')

  const parsed = blacklistSchema.safeParse({
    customerId: String(formData.get('customerId') ?? ''),
    reason: String(formData.get('reason') ?? '').trim(),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  if (parsed.data.customerId === session.id) {
    return { ok: false, error: 'ไม่สามารถติดแบล็คลิสต์บัญชีของตัวเองได้' }
  }

  try {
    await blacklistCustomer({
      targetId: parsed.data.customerId,
      reason: parsed.data.reason ?? null,
      actorId: session.id,
    })

    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: null,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'customer_blacklisted',
      description: parsed.data.reason
        ? `Customer blacklisted — ${parsed.data.reason}`
        : 'Customer blacklisted',
      metadata: { target_customer_id: parsed.data.customerId },
    })

    revalidatePath('/admin/customers')
    revalidatePath(`/admin/customers/${parsed.data.customerId}`)
    revalidatePath('/reception/blacklist')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถติดแบล็คลิสต์ได้')
  }
}

export async function unblacklistCustomerAction(
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

  try {
    await unblacklistCustomer({ targetId: parsed.data.customerId })

    const admin = await createAdminClient()
    await admin.from('booking_events').insert({
      booking_id: null,
      actor_id: session.id,
      actor_role: session.role,
      event_type: 'customer_unblacklisted',
      description: 'Customer removed from blacklist',
      metadata: { target_customer_id: parsed.data.customerId },
    })

    revalidatePath('/admin/customers')
    revalidatePath(`/admin/customers/${parsed.data.customerId}`)
    revalidatePath('/reception/blacklist')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถปลดแบล็คลิสต์ได้')
  }
}
