'use server'

/**
 * Phase 26 mini — set the active locale.
 *
 * Used by <LanguageToggle> via a plain `<form action={setLocaleAction}>`.
 * Writes the `NEXT_LOCALE` cookie, persists to `profiles.locale` for
 * authed users, then revalidates the layout so server-rendered strings
 * pick up the new locale on the next render.
 *
 * The action signature is the standard `(formData) => void` form action
 * shape (no useActionState wrapper), because <LanguageToggle> renders
 * two plain forms — one per locale.
 */
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getSession } from '@/lib/supabase/getSession'
import { createClient } from '@/lib/supabase/server'
import { LOCALE_COOKIE, toLocale } from '@/lib/i18n/config'

const setLocaleSchema = z.object({
  locale: z.string(),
})

export async function setLocaleAction(formData: FormData): Promise<void> {
  const parsed = setLocaleSchema.safeParse({
    locale: String(formData.get('locale') ?? ''),
  })
  if (!parsed.success) return // Invalid input — silently ignore (defensive)
  const locale = toLocale(parsed.data.locale)

  try {
    // 1. Set the cookie (1 year expiry).
    const cookieStore = await cookies()
    cookieStore.set({
      name: LOCALE_COOKIE,
      value: locale,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    // 2. Persist to profiles.locale for authed users.
    const session = await getSession()
    if (session) {
      const supabase = await createClient()
      await supabase.from('profiles').update({ locale }).eq('id', session.id)
    }
  } catch {
    // No form to surface errors to (no useActionState wrapper) — swallow.
    return
  }

  // 3. Revalidate the layout so server components re-render with the
  // new locale. `router.refresh()` is NOT needed — revalidatePath
  // tells Next to invalidate the route segment.
  revalidatePath('/', 'layout')
}
