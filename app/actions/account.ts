'use server'

import { getServerT } from '@/lib/i18n/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { localizeIssueMessage } from '@/lib/errors/translate'
import { createClient } from '@/lib/supabase/server'
import {
  updateOwnProfile,
  uploadOwnAvatar,
  putAvatarToR2,
} from '@/lib/data/account'

export type AccountActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// updateProfileAction
// ---------------------------------------------------------------------------

// Phone is required at the DB layer (NOT NULL + regex CHECK via migration
// 20260913_require_phone.sql), but we allow empty here so staff with
// placeholder/missing data can still save phone. DB will surface the
// NOT NULL violation if the row truly has no valid phone — `actionFail`
// catches it and renders a clear error.
const basePhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^(|0{10}|[0-9]{10})$/,
      'validation.phone10OrEmpty',
    ),
})

// User (customer) retains full edit on name + birthdate.
const userFullSchema = basePhoneSchema.extend({
  fullName: z.string().trim().min(1, 'validation.fullNameRequired').max(120),
  birthdate: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'validation.birthdateFormat',
    ),
})

export async function updateProfileAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  const { locale, t } = await getServerT()
  // Accept any authenticated user; the data layer enforces owner-only
  // access via RLS (profiles.id = auth.uid()). Profile pages gate the
  // role match via `app/[role]/layout.tsx` redirects.
  const session = await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )

  // Staff (reception/housekeeper/manager/admin) can only edit phone.
  // full_name + birthdate are verified personal data locked in the UI
  // and stripped from the schema. Admin can change them via
  // /admin/staff/[id]/edit instead.
  const isStaff = session.role !== 'user'
  const schema = isStaff ? basePhoneSchema : userFullSchema

  const rawCandidate = {
    phone: String(formData.get('phone') ?? ''),
    ...(isStaff
      ? {}
      : {
          fullName: String(formData.get('fullName') ?? ''),
          birthdate: String(formData.get('birthdate') ?? ''),
        }),
  }
  const parsed = schema.safeParse(rawCandidate)
  if (!parsed.success) {
    return { ok: false, error: localizeIssueMessage(parsed.error.issues[0]?.message ?? t('actions.common.invalidInputPlain'), locale) }
  }

  try {
    // Build the update payload from the parsed (schema-stripped) shape.
    // For staff: only phone. For User: phone + full_name + birthdate.
    if (isStaff) {
      await updateOwnProfile({ phone: parsed.data.phone })
    } else {
      // After the schema branch, parsed.data is userFullSchema's shape.
      // Rename fullName → full_name at the data-layer boundary
      // (PostgREST uses snake_case column names).
      const { phone, fullName: full_name, birthdate } = parsed.data as {
        phone: string
        fullName: string
        birthdate: string
      }
      await updateOwnProfile({
        phone,
        full_name,
        birthdate: birthdate === '' ? null : birthdate,
      })
    }
    revalidatePath('/', 'layout')
    // Re-validate every profile route — this action is reachable from
    // /account/profile (User) + /admin|manager|reception|housekeeper/profile
    // (staff). Without listing each staff path, those pages keep serving
    // the stale RSC payload until a hard refresh — looks like the change
    // "didn't save" even though the DB row IS updated.
    revalidatePath('/account/profile')
    revalidatePath('/admin/profile')
    revalidatePath('/manager/profile')
    revalidatePath('/reception/profile')
    revalidatePath('/housekeeper/profile')
    return { ok: true }
  } catch (e) {
    return actionFail(e, t('actions.account.saveProfileFailed'))
  }
}

// ---------------------------------------------------------------------------
// changePasswordAction
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.currentPasswordRequired'),
    newPassword: z
      .string()
      .min(8, 'validation.newPasswordMin')
      .max(72, 'validation.newPasswordMax'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'validation.passwordMismatch',
  })

export async function changePasswordAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  const { locale, t } = await getServerT()
  const session = await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )
  const email = session.email
  if (!email) {
    return { ok: false, error: t('actions.account.noAccountEmail') }
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmNewPassword: String(formData.get('confirmNewPassword') ?? ''),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: localizeIssueMessage(parsed.error.issues[0]?.message ?? t('actions.common.invalidInputPlain'), locale),
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
    return { ok: false, error: t('actions.account.wrongCurrentPassword') }
  }

  // Step 2 — actually change the password.
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (updateError) {
    return actionFail(updateError, t('actions.account.changePasswordFailed'))
  }

  revalidatePath('/', 'layout')
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
  const { t } = await getServerT()
  const session = await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t('actions.account.chooseImage') }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: t('actions.account.fileTooLarge') }
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return { ok: false, error: t('actions.account.imageTypes') }
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
    return actionFail(e, t('actions.account.uploadAvatarFailed'))
  }

  revalidatePath('/', 'layout')
  revalidatePath('/account/profile')
  return { ok: true, data: { avatarKey } }
}