'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './auth'
import {
  updateOwnProfile,
  deactivateOwnAccount,
  uploadOwnAvatar,
  putAvatarToR2,
} from '@/lib/data/account'

export type AccountActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// updateProfileAction
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ห้ามมีขีดหรือช่องว่าง'),
  birthdate: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD',
    ),
})

export async function updateProfileAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  await requireRole('user', '/account/profile')

  const parsed = updateProfileSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    birthdate: String(formData.get('birthdate') ?? ''),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }

  try {
    await updateOwnProfile({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      birthdate: parsed.data.birthdate === '' ? null : parsed.data.birthdate,
    })
    revalidatePath('/', 'layout')
    revalidatePath('/account/profile')
    return { ok: true }
  } catch (e) {
    return actionFail(e, 'ไม่สามารถบันทึกข้อมูลส่วนตัวได้')
  }
}

// ---------------------------------------------------------------------------
// changePasswordAction
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: z
      .string()
      .min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      .max(72, 'รหัสผ่านใหม่ต้องไม่เกิน 72 ตัวอักษร'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
  })

export async function changePasswordAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  const session = await requireRole('user', '/account/profile')
  const email = session.email
  if (!email) {
    return { ok: false, error: 'ไม่พบอีเมลของบัญชี กรุณาติดต่อผู้ดูแลระบบ' }
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmNewPassword: String(formData.get('confirmNewPassword') ?? ''),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  const supabase = await createClient()

  // Step 1 — verify current password by attempting to sign in.
  // Supabase auth.updateUser for password requires a recent login; we use
  // signInWithPassword to re-verify the credential before calling it.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })
  if (signInError) {
    return { ok: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }
  }

  // Step 2 — actually change the password.
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (updateError) {
    return actionFail(updateError, 'ไม่สามารถเปลี่ยนรหัสผ่านได้')
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// deactivateAccountAction
// ---------------------------------------------------------------------------

const deactivateSchema = z.object({
  confirmText: z.string(),
})

export async function deactivateAccountAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  await requireRole('user', '/account/profile')

  const parsed = deactivateSchema.safeParse({
    confirmText: String(formData.get('confirmText') ?? '').trim(),
  })
  if (!parsed.success) {
    return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  }

  // Mockup requires user to type "ลบบัญชี" verbatim before submission.
  if (parsed.data.confirmText !== 'ลบบัญชี') {
    return { ok: false, error: 'กรุณาพิมพ์ "ลบบัญชี" ให้ตรงกันเพื่อยืนยัน' }
  }

  try {
    // Soft-delete (flips is_active=false) — non-destructive; preserves
    // bookings + reviews for analytics / dispute resolution.
    await deactivateOwnAccount()
  } catch (e) {
    return actionFail(e, 'ไม่สามารถลบบัญชีได้')
  }

  // signOut() calls redirect('/') which throws NEXT_REDIRECT — TypeScript
  // can't see that, so wrap in try/catch (any thrown value here means
  // "redirect succeeded, browser is navigating"). Reaching the success
  // branch below is only possible if the redirect fails.
  try {
    await signOut()
  } catch {
    // Redirect initiated — caller won't see this branch.
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// uploadAvatarAction
// ---------------------------------------------------------------------------

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

export async function uploadAvatarAction(
  _state: AccountActionResult<{ avatarKey: string }> | null,
  formData: FormData,
): Promise<AccountActionResult<{ avatarKey: string }>> {
  const session = await requireRole('user', '/account/profile')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: 'ไฟล์ต้องมีขนาดไม่เกิน 2 MB' }
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: 'รองรับเฉพาะไฟล์ JPEG, PNG, WebP เท่านั้น' }
  }

  // Build an avatar key scoped to the user. crypto.randomUUID() prevents
  // collision if the user uploads twice in the same millisecond.
  const ext =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : 'webp'
  const avatarKey = `users/${session.id}/${crypto.randomUUID()}.${ext}`

  try {
    const arrayBuffer = await file.arrayBuffer()
    await putAvatarToR2({
      avatarKey,
      body: arrayBuffer,
      contentType: file.type,
    })
    await uploadOwnAvatar(avatarKey)
  } catch (e) {
    return actionFail(e, 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/account/profile')
  return { ok: true, data: { avatarKey } }
}