'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitizeNext } from '@/app/auth/next-utils'

export interface AuthState {
  error?: string
  success?: boolean
}

export async function signIn(prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/')

  if (!email || !password) {
    return { error: 'กรุณากรอกอีเมลและรหัสผ่าน' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
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

  // Validation
  if (!fullName || !email || !password) {
    return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }
  if (password !== confirmPassword) {
    return { error: 'รหัสผ่านยืนยันไม่ตรงกัน' }
  }
  if (password.length < 8) {
    return { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone || null,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Sign out — called from a Server Action form (TopNavBar).
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
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
    },
  })

  if (error) {
    // Phase 14 follow-up — the most common failure is the Google provider not
    // being enabled in the user's Supabase dashboard. The raw Supabase message
    // ("Unsupported provider: provider is not enabled") is jargon; translate
    // it to a Thai hint that points at the dashboard fix instead.
    if (error.message?.includes('provider is not enabled')) {
      return { error: 'Google OAuth ยังไม่ได้เปิดใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบ' }
    }
    return { error: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ' + error.message }
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
