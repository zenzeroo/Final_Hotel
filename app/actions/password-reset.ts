'use server'

/**
 * Forgot Password / Reset Password server actions.
 *
 * Two flows:
 *   1. `requestPasswordResetAction` — user enters email on
 *      /forgot-password → sends Supabase password-reset email.
 *      Always returns generic success regardless of whether the email
 *      exists (no-enumeration rule for security).
 *   2. `resetPasswordAction` — user clicks email link, lands on
 *      /reset-password with a recovery session, enters new password →
 *      `supabase.auth.updateUser({ password })`.
 *
 * Both flows are POST mutations → rate-limited via proxy.ts + the new
 * `/forgot-password` (5/min) and `/reset-password` (10/min) entries
 * in lib/rate-limit.ts.
 *
 * Google-only accounts: a user with only a Google identity who clicks
 * the reset link and sets a password will end up with BOTH identities
 * (Google + email/password). They can unlink Google later via
 * /account/profile (Phase 37). No special-case detection — Supabase
 * default works as-is.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'
import { env } from '@/lib/env'

// ─────────────────────────────────────────────────────────────────────
// requestPasswordResetAction
// ─────────────────────────────────────────────────────────────────────

const requestResetSchema = z.object({
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
})

export type RequestPasswordResetResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

/**
 * Phase 41 — initiate password reset. Always returns the same generic
 * success message regardless of whether the email exists in auth.users,
 * to prevent user enumeration attacks. Supabase's resetPasswordForEmail
 * also silently "succeeds" for unknown emails — the two layers match.
 */
export async function requestPasswordResetAction(
  _prev: RequestPasswordResetResult | null,
  formData: FormData,
): Promise<RequestPasswordResetResult> {
  const parsed = requestResetSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: translateZodIssues(parsed.error.issues) || 'ข้อมูลไม่ถูกต้อง',
    }
  }

  const supabase = await createClient()
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // The redirectTo must go through /auth/callback so Supabase can
  // exchange the code for a session cookie. We pass ?next=/reset-password
  // — the callback route's amr.recovery detection skips the roleHomePath
  // override (otherwise staff users would land on /admin etc).
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  })

  // Supabase's resetPasswordForEmail returns success even for unknown
  // emails (intentional, anti-enumeration). We log errors server-side
  // but never surface them to the user — same generic success either way.
  if (error) {
    console.error('[requestPasswordResetAction] supabase error:', error.message)
  }

  return {
    ok: true,
    message:
      'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว กรุณาตรวจสอบกล่องข้อความและคลิกลิงก์เพื่อดำเนินการต่อ',
  }
}

// ─────────────────────────────────────────────────────────────────────
// resetPasswordAction
// ─────────────────────────────────────────────────────────────────────

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      .max(72, 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'รหัสผ่านยืนยันไม่ตรงกัน',
  })

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Update the current user's password via supabase.auth.updateUser.
 * Requires an active session — the user must have clicked the email
 * link (which sets up a recovery session cookie via /auth/callback).
 *
 * If the session is missing or expired, returns an error so the page
 * can show the "ลิงก์หมดอายุ" message + a link back to
 * /forgot-password.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const parsed = resetSchema.safeParse({
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      error: 'เซสชั่นหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์รีเซ็ตใหม่อีกครั้ง',
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (error) {
    return { ok: false, error: translateSupabaseError(error.message) }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
