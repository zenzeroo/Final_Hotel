'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import {
  createStaff,
  updateStaff,
  setStaffActive,
  countActiveAdmins,
} from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

const createStaffSchema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['reception', 'housekeeper', 'manager', 'admin']),
  phone: z.string().max(40).nullable(),
  password: z.string().min(8).max(72),
})

export async function createStaffAction(formData: FormData): Promise<ActionResult<{ initialPassword: string }>> {
  await requireRole('admin', '/admin/staff')

  const candidate = {
    full_name: String(formData.get('full_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    role: String(formData.get('role') ?? 'reception'),
    phone: (() => {
      const v = String(formData.get('phone') ?? '').trim()
      return v === '' ? null : v
    })(),
    password: String(formData.get('password') ?? ''),
  }

  const parsed = createStaffSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  try {
    const { initialPassword } = await createStaff(parsed.data)
    revalidatePath('/admin/staff')
    return { ok: true, data: { initialPassword } }
  } catch (e) {
    return actionFail(e, 'Could not create staff member')
  }
}

const updateStaffSchema = z.object({
  id: z.string().min(1),
  full_name: z.string().min(1).max(120),
  phone: z.string().max(40).nullable(),
  role: z.enum(['reception', 'housekeeper', 'manager', 'admin']),
  is_active: z.boolean(),
})

export async function updateStaffAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/staff')

  const candidate = {
    id: String(formData.get('id') ?? '').trim(),
    full_name: String(formData.get('full_name') ?? '').trim(),
    phone: (() => {
      const v = String(formData.get('phone') ?? '').trim()
      return v === '' ? null : v
    })(),
    role: String(formData.get('role') ?? 'reception'),
    is_active: formData.get('is_active') === 'true',
  }

  const parsed = updateStaffSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid input: ' + parsed.error.issues[0]?.message }
  }

  // Self-modification guard: cannot demote or deactivate self.
  if (parsed.data.id === session.id) {
    if (parsed.data.role !== 'admin') {
      return { ok: false, error: 'You cannot change your own role' }
    }
    if (!parsed.data.is_active) {
      return { ok: false, error: 'You cannot deactivate your own account' }
    }
  }

  // Last-admin guard: cannot demote or deactivate the last remaining admin.
  if (parsed.data.role !== 'admin' || !parsed.data.is_active) {
    // Check if the target is currently an admin (before update)
    const { listStaff } = await import('@/lib/data/manager')
    const allStaff = await listStaff()
    const target = allStaff.find((s) => s.id === parsed.data.id)
    if (target && target.role === 'admin' && target.is_active) {
      const remaining = await countActiveAdmins(parsed.data.id)
      if (remaining === 0) {
        return { ok: false, error: 'Cannot demote/deactivate the last active admin' }
      }
    }
  }

  try {
    await updateStaff({
      id: parsed.data.id,
      patch: {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        role: parsed.data.role,
        is_active: parsed.data.is_active,
      },
    })
  } catch (e) {
    return actionFail(e, 'Could not update staff member')
  }

  revalidatePath('/admin/staff')
  return { ok: true }
}

export async function setStaffActiveAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole('admin', '/admin/staff')

  const staffId = String(formData.get('staffId') ?? '').trim()
  const isActive = formData.get('isActive') === 'true'

  if (!staffId) return { ok: false, error: 'Missing staff id' }

  // Self-modification guard
  if (staffId === session.id && !isActive) {
    return { ok: false, error: 'You cannot deactivate your own account' }
  }

  // Last-admin guard
  if (!isActive) {
    const { listStaff } = await import('@/lib/data/manager')
    const allStaff = await listStaff()
    const target = allStaff.find((s) => s.id === staffId)
    if (target && target.role === 'admin' && target.is_active) {
      const remaining = await countActiveAdmins(staffId)
      if (remaining === 0) {
        return { ok: false, error: 'Cannot deactivate the last active admin' }
      }
    }
  }

  try {
    await setStaffActive({ staffId, isActive })
  } catch (e) {
    return actionFail(e, 'Could not update staff status')
  }

  revalidatePath('/admin/staff')
  return { ok: true }
}
