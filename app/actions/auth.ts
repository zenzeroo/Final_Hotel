'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
