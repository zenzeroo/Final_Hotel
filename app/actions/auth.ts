'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sanitizeNext } from '@/lib/auth/sanitize'
import { translateSupabaseError, translateZodIssues } from '@/lib/errors/translate'
import { isOver18 } from '@/lib/dates'

// Sign-up schema — same phone regex used by BookingForm / WalkInForm /
// PersonalInfoForm (10 ASCII digits, no dashes/spaces). Server-side gate so
// even direct callers (bypass HTML5 required + pattern) get a clear error.
const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120),
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ห้ามมีขีดหรือช่องว่าง'),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD')
    .refine(isOver18, 'ต้องมีอายุ 18 ปีขึ้นไป'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(72),
  confirmPassword: z.string(),
  next: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  path: ['confirmPassword'],
  message: 'รหัสผ่านยืนยันไม่ตรงกัน',
})

export interface AuthState {
  error?: string
  success?: boolean
}

export async function signIn(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const { cookies } = await import('next/headers')
  const { LOCALE_COOKIE, toLocale } = await import('@/lib/i18n/config')
  const cookieStore = await cookies()
  const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/')

  if (!email || !password) {
    return { error: locale === 'en' ? 'Please enter email and password' : 'กรุณากรอกอีเมลและรหัสผ่าน' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Surface the real reason in the active locale (e.g. "email not
    // confirmed" → localized). Falls back to the generic wrong-password
    // message only when Supabase's error message isn't in the known map.
    const localized = translateSupabaseError(error.message, locale)
    if (localized) return { error: localized }
    return {
      error: locale === 'en' ? 'Invalid email or password' : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    }
  }

  // Auto-redirect based on role. Phase 11: staff ALWAYS land on their own
  // dashboard, ignoring `?next=` (prevents phishing via crafted login links
  // like /login?next=/admin/dangerous-action). Regular `user` role honours
  // `?next=` so deep-links to /bookings/[id] still work.
  let redirectTo = next && next !== '/' ? next : '/'

  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    const role = profile?.role
    if (role === 'admin') {
      redirectTo = '/admin'
    } else if (role === 'reception') {
      redirectTo = '/reception'
    } else if (role === 'housekeeper') {
      redirectTo = '/housekeeper'
    } else if (role === 'manager') {
      redirectTo = '/manager'
    }
    // role === 'user' (or null/missing) → keep redirectTo (= next or '/')
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

export async function signUp(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')
  const phone = String(formData.get('phone') ?? '').trim()
  const birthdate = String(formData.get('birthdate') ?? '').trim()
  // Read + sanitize the `next` deep-link so a confirmed user resumes
  // their booking instead of always landing on `/`.
  const next = sanitizeNext(String(formData.get('next') ?? '/'))

  // Validation — Zod schema enforces required + regex on phone (server-side
  // mirror of RegisterForm.tsx HTML5 required + pattern). Error message
  // localized via the same pattern signIn uses for Supabase errors.
  const parsed = signUpSchema.safeParse({ fullName, email, phone, birthdate, password, confirmPassword, next })
  if (!parsed.success) {
    const { cookies } = await import('next/headers')
    const { LOCALE_COOKIE, toLocale } = await import('@/lib/i18n/config')
    const cookieStore = await cookies()
    const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value)
    return {
      error: 'ข้อมูลไม่ถูกต้อง: ' + translateZodIssues(parsed.error.issues, locale),
    }
  }
  const formDataParsed = parsed.data

  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signUp({
    email: formDataParsed.email,
    password: formDataParsed.password,
    options: {
      data: {
        full_name: formDataParsed.fullName,
        phone: formDataParsed.phone,
        birthdate: formDataParsed.birthdate,
      },
      // Tell Supabase where to send the user after they click the
      // confirmation link in their email. `emailRedirectTo` is ignored
      // when the Dashboard "Confirm email" toggle is OFF, but always
      // setting it keeps the contract stable across both modes.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    const { cookies } = await import('next/headers')
    const { LOCALE_COOKIE, toLocale } = await import('@/lib/i18n/config')
    const cookieStore = await cookies()
    const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value)
    return {
      error: translateSupabaseError(error.message, locale) ?? 'สมัครสมาชิกไม่สำเร็จ',
    }
  }

  // Email confirmation is enabled in the Supabase Dashboard → Auth →
  // Providers → Email. In that mode `data.session` is null until the
  // user clicks the confirmation link; we must NOT `redirect('/')` —
  // that would silently land them on the homepage logged-out with no
  // explanation. Instead, bounce them back to /register with an info
  // banner that tells them to check their inbox.
  if (!data.session) {
    redirect(`/register?message=check_email&next=${encodeURIComponent(next)}`)
  }

  // Auto-confirm path (Dashboard toggle off, or auto-confirm via OAuth).
  revalidatePath('/', 'layout')
  redirect(next)
}

/**
 * Sign out — called from a Server Action form (TopNavBar).
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Phase 27.G — clear the user's locale cookie so an anonymous user on a
  // shared device doesn't inherit the previous user's language choice.
  // Mirrors the locale-cookie pattern used by signIn + signUp above.
  const { cookies } = await import('next/headers')
  const { LOCALE_COOKIE } = await import('@/lib/i18n/config')
  const cookieStore = await cookies()
  cookieStore.delete(LOCALE_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Phase 14 — Sign in (or sign up) with Google via Supabase's hosted OAuth flow.
 *
 * The OAuth client credentials live in the Supabase dashboard (Authentication
 * → Providers → Google), not in this codebase — so there are no secrets here.
 *
 * Flow:
 *   1. Call `supabase.auth.signInWithOAuth({ provider: 'google' })` — Supabase
 *      returns a Google consent-screen URL.
 *   2. `redirect()` the browser to that URL.
 *   3. Google returns to `<site>/auth/callback?code=...&next=...` (see
 *      `app/auth/callback/route.ts`), which exchanges the code for a session
 *      cookie + looks up `profiles.role` for the final redirect target.
 *
 * `next` is the deep-link target the user was trying to reach (e.g. a booking
 * detail page); it's sanitized via `sanitizeNext` to prevent open-redirect.
 *
 * Called from the LoginForm + RegisterForm Google buttons via onClick +
 * `useTransition`. The `redirect()` call throws a special error that Next.js
 * catches server-side and turns into a 303 navigation — so this function
 * never returns on the happy path; it only returns `{ error }` if
 * `signInWithOAuth` itself fails before redirecting.
 */
export async function signInWithGoogle(next: string): Promise<AuthState> {
  const supabase = await createClient()
  const safeNext = sanitizeNext(next)
  const origin = await getOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      // Force the Google account picker every time — prevents silent
      // auto-login of the wrong account on shared devices, and matches
      // the standard expectation for login UX (Google's own docs recommend
      // `prompt=select_account` for SPAs / web apps).
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    // Phase 14 follow-up — the most common failure is the Google provider not
    // being enabled in the user's Supabase dashboard. The raw Supabase message
    // ("Unsupported provider: provider is not enabled") is jargon; translate
    // it to a Thai hint that names the exact dashboard path so the admin can
    // resolve it without reading docs/. Setup steps live in
    // `docs/google-oauth-setup.md`.
    if (error.message?.includes('provider is not enabled')) {
      return {
        error:
          'Google OAuth ยังไม่ได้เปิดใช้งาน — แอดมินต้องไป enable ที่ ' +
          'Supabase Dashboard → Authentication → Providers → Google',
      }
    }
    return { error: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ' + translateSupabaseError(error.message) }
  }
  if (!data?.url) {
    return { error: 'ไม่ได้รับ URL จาก Google — กรุณาลองใหม่อีกครั้ง' }
  }

  // redirect() throws — Next.js handles the browser navigation.
  redirect(data.url)
}

/**
 * Derive the request origin from headers. Works on dev (localhost:3000 over
 * http), staging, and prod (https via x-forwarded-proto) without env config.
 */
async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  // x-forwarded-proto is set by Vercel / reverse proxies; fall back to a
  // safe default that matches dev (localhost = http, anything else = https).
  const proto =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
