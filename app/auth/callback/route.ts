/**
 * Phase 14 — OAuth callback handler.
 *
 * Google (or any other Supabase-hosted OAuth provider) redirects the browser
 * here after the user grants consent. Supabase appends `?code=...` (PKCE
 * authorization code) which we exchange for a session cookie.
 *
 * Once the session is established, the user is redirected to either:
 *   - `?next=` deep link (for normal users) — sanitized to prevent open-redirect
 *   - the role-specific home (admin / manager / reception / housekeeper) —
 *     staff ALWAYS land on their own dashboard, matching `signIn` behavior
 *
 * Phase 37 — `?intent=link` distinguishes identity-linking callbacks from
 * first-time sign-in. Linking flow must NOT create a new auth.users row;
 * it attaches a new identity (Google) to the existing session's user.
 * The intent=link flag forces the redirect back to /account/profile so
 * the LinkedAccountsCard can show "Google: connected". Regular sign-in
 * (no intent) preserves the role-home routing.
 *
 * Profile creation is handled automatically by the `handle_new_user()` trigger
 * (db-schemas/20260832_staff_shifts_and_email.sql:25-51) — by the time we
 * look up `profiles.role` here, the row exists.
 *
 * Failure paths:
 *   - No `code` param (user cancelled) → `/login?error=oauth_cancelled`
 *   - `exchangeCodeForSession` error → `/login?error=oauth_failed`
 *   - Linking-specific failure (user cancelled Google consent mid-link) →
 *     `/account/profile?link_error=cancelled` so the card can show a
 *     localized banner instead of falling through to /login.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { roleHomePath, type UserRole } from '@/lib/supabase/getSession'
import { sanitizeNext } from '@/lib/auth/sanitize'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeNext(searchParams.get('next'))
  const intent = searchParams.get('intent')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Session established. Resolve role-based home.

      // Phase 37 — Linking flow always returns to /account/profile so the
      // LinkedAccountsCard can render the "Google: connected" state. We
      // deliberately IGNORE `?next=` for intent=link to avoid leaking the
      // linking callback into a public route mid-flow.
      if (intent === 'link') {
        return NextResponse.redirect(`${origin}/account/profile?linked=google`)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      let redirectTo = next
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        // Staff always lands on their own dashboard (anti-phishing).
        // Regular users honour `?next=` deep link.
        if (profile?.role && profile.role !== 'user') {
          redirectTo = roleHomePath(profile.role as UserRole)
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // No code, or exchange failed — fall back appropriately.
  if (intent === 'link') {
    // Linking-specific cancellation goes back to /account/profile so the
    // card shows a "ยกเลิก" hint, not a "ต้องเข้าสู่ระบบ" redirect.
    return NextResponse.redirect(`${origin}/account/profile?link_error=cancelled`)
  }

  // Supabase appends `?error_description=...` for the exchange failure case;
  // we drop it and use a generic flag so the form can show a friendly message.
  return NextResponse.redirect(
    code ? `${origin}/login?error=oauth_failed` : `${origin}/login?error=oauth_cancelled`,
  )
}
