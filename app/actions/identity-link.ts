'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import {
  listMyIdentities,
  hasPasswordIdentity,
  checkIdentityLinkSafety,
  getGoogleLinkUrl,
  setPasswordViaAdmin,
  unlinkIdentityById,
} from '@/lib/data/supabase-account'
import { createClient } from '@/lib/supabase/server'
import type { AccountActionResult } from './account'

// Re-export so client components importing identity-link actions can pull
// the same result type used by useActionState.
export type AccountIdentityActionResult = AccountActionResult

// ============================================================
// Phase 37 — Identity linking (multi-provider sign-in / sign-up)
// ============================================================
//
// Lets users combine email/password AND Google OAuth into ONE account.
//
// UI entry points (all in /account/profile):
//   - LinkedAccountsCard — shows current identities + Connect/Disconnect
//   - AccountSecuritySection — branches ChangePassword vs SetPassword
//   based on whether email identity exists.
//
// Security model (requirement #3):
//   Only link accounts when the email is VERIFIED on both sides. The
//   can_link_identity_by_email() SQL function (migration 20261001) is
//   the authoritative gate — the Dashboard "Manual Linking" toggle is
//   also required but provides defense-in-depth, not the primary check.
// ============================================================

// ---------------------------------------------------------------------------
// Read-only helpers used by the LinkedAccountsCard
// ---------------------------------------------------------------------------

/**
 * Server-friendly wrapper for the UI. Returns the linked identities for
 * the current user (empty array if not signed in).
 */
export async function getMyLinkedIdentities(): Promise<
  Awaited<ReturnType<typeof listMyIdentities>>
> {
  return await listMyIdentities()
}

/**
 * True iff the user has an email/password identity — used by
 * AccountSecuritySection to branch between "Change password" and
 * "Set a password" UI.
 */
export async function getHasPasswordIdentity(): Promise<boolean> {
  return await hasPasswordIdentity()
}

// ---------------------------------------------------------------------------
// startLinkGoogleIdentityAction — initiate OAuth linking flow
// ---------------------------------------------------------------------------

/**
 * Phase 37 — start Google OAuth as identity-linking (NOT sign-in).
 * The user must already be signed in. The flow:
 *   1. Server action validates session + email verification on BOTH sides
 *      via can_link_identity_by_email() SQL helper.
 *   2. Calls supabase.auth.linkIdentity({ provider: 'google' }) which
 *      returns a Google consent URL.
 *   3. `redirect(url)` — browser navigates to Google consent.
 *   4. After consent, Google redirects to /auth/callback?intent=link
 *      which exchanges the code + attaches the Google identity to the
 *      currently signed-in user (NOT creates a new auth.users row).
 *
 * Edge cases:
 *   - Session expired → requireRole redirect to /login.
 *   - Email mismatch (OAuth email differs from current user's email) →
 *     refuse with localized error.
 *   - Already linked → linkIdentity returns "identity already linked".
 */
export async function startLinkGoogleIdentityAction(
  _state: AccountActionResult | null,
  _formData: FormData,
): Promise<AccountActionResult | never> {
  // Both params are intentionally unused — the action kicks off the
  // OAuth flow via supabase.auth.linkIdentity() with no form fields.
  // Mark them "used" so ESLint's no-unused-vars doesn't trip on the
  // React-action signature contract.
  void _state
  void _formData

  const session = await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )

  if (!session.email) {
    return { ok: false, error: 'ไม่พบอีเมลของบัญชี' }
  }

  // Re-fetch the raw user so we can confirm email_confirmed_at is set
  // (defense-in-depth — the SQL helper already checks this).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email_confirmed_at) {
    return {
      ok: false,
      error: 'อีเมลของคุณยังไม่ได้รับการยืนยัน กรุณายืนยันอีเมลก่อนเชื่อมต่อบัญชี Google',
    }
  }

  const safety = await checkIdentityLinkSafety({
    existingEmail: session.email,
    newEmailVerified: true, // Google always sets email_verified=true for its flow
  })

  if (!safety.safeToLink && safety.reason === 'existing_email_unverified') {
    return {
      ok: false,
      error:
        'อีเมลของบัญชีนี้ยังไม่ได้รับการยืนยัน กรุณายืนยันอีเมลก่อนเชื่อมต่อบัญชี Google',
    }
  }

  // Build the link URL via supabase.auth.linkIdentity().
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  let url: string | null
  try {
    url = await getGoogleLinkUrl({
      origin,
      next: '/account/profile?linked=google',
    })
  } catch (e) {
    return actionFail(e, 'ไม่สามารถเริ่มการเชื่อมต่อ Google ได้')
  }

  if (!url) {
    return {
      ok: false,
      error:
        'ไม่สามารถเชื่อมต่อบัญชี Google ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ',
    }
  }

  // Redirect to Google consent — throws NEXT_REDIRECT (never returns).
  redirect(url)
}

// ---------------------------------------------------------------------------
// setPasswordForOAuthOnlyAction — set a password on a Google-only account
// ---------------------------------------------------------------------------

const setPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      .max(72, 'รหัสผ่านใหม่ต้องไม่เกิน 72 ตัวอักษร'),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน',
  })

/**
 * Phase 37 — set a password on an account that has no email/password
 * identity (Google-only sign-up). Server uses the service-role admin
 * client because the user doesn't have an existing password to verify.
 *
 * UI label is "ตั้งรหัสผ่าน" (set password) instead of "เปลี่ยนรหัสผ่าน"
 * (change password) — the difference is semantic, not technical.
 *
 * Pre-check via hasPasswordIdentity() — refuses if already has a password
 * (would-be user should use changePasswordAction instead).
 */
export async function setPasswordForOAuthOnlyAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  const session = await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )

  // Refuse if user already has a password — they should use the change flow.
  if (await hasPasswordIdentity()) {
    return {
      ok: false,
      error: 'บัญชีนี้มีรหัสผ่านอยู่แล้ว กรุณาใช้ฟอร์มเปลี่ยนรหัสผ่าน',
    }
  }

  const parsed = setPasswordSchema.safeParse({
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  try {
    await setPasswordViaAdmin({
      userId: session.id,
      newPassword: parsed.data.newPassword,
    })
  } catch (e) {
    return actionFail(e, 'ไม่สามารถตั้งรหัสผ่านได้')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/account/profile')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// unlinkIdentityAction — disconnect an identity from the current user
// ---------------------------------------------------------------------------

const unlinkSchema = z.object({
  identityId: z.string().min(1, 'ไม่พบตัวตนที่ต้องการยกเลิกการเชื่อมต่อ'),
})

/**
 * Phase 37 — disconnect an identity (e.g. unlink Google from an account
 * that primarily uses email/password, OR vice versa).
 *
 * Refuses if removing would leave the user with zero identities
 * (would lock them out permanently — no method left to sign in).
 */
export async function unlinkIdentityAction(
  _state: AccountActionResult | null,
  formData: FormData,
): Promise<AccountActionResult> {
  await requireRole(
    ['user', 'reception', 'housekeeper', 'manager', 'admin'],
    '/account/profile',
  )

  const parsed = unlinkSchema.safeParse({
    identityId: String(formData.get('identityId') ?? ''),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
    }
  }

  try {
    await unlinkIdentityById(parsed.data.identityId)
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'CANNOT_UNLINK_LAST_IDENTITY') {
      return {
        ok: false,
        error:
          'ไม่สามารถยกเลิกการเชื่อมต่อวิธีเข้าสู่ระบบสุดท้ายได้ บัญชีของคุณต้องมีวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี',
      }
    }
    if (msg === 'IDENTITY_NOT_FOUND') {
      return {
        ok: false,
        error: 'ไม่พบตัวตนนี้ในระบบ (อาจถูกยกเลิกการเชื่อมต่อไปแล้ว)',
      }
    }
    return actionFail(e, 'ไม่สามารถยกเลิกการเชื่อมต่อได้')
  }

  revalidatePath('/', 'layout')
  revalidatePath('/account/profile')
  return { ok: true }
}
