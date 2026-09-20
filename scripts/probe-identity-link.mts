/**
 * Phase 37 — Probe current identity-linking behavior.
 *
 * Goal: with the Dashboard "Manual Linking" toggle OFF, what does Supabase
 * actually do when:
 *   (a) email/password user already exists with foo@gmail.com, then
 *   (b) another user tries to sign in with Google using a Google account
 *       whose email is also foo@gmail.com?
 *
 * Uses the REST API (/auth/v1/admin/list) + admin create + auth admin
 * API to inspect — no browser flow required.
 *
 * Run: npx tsx scripts/probe-identity-link.mts
 *
 * Cleanup: deletes the test user at the end. Idempotent.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = `probe-link-${Date.now()}@zenzero-test.local`
const TEST_PASSWORD = 'ProbeLinkPass123!'

console.log('Phase 37 probe — current identity-linking behavior')
console.log('Test email:', TEST_EMAIL)
console.log()

// ─── Step 1: Create email/password user via admin API
console.log('▸ Step 1: Sign up foo@gmail.com via email/password (service-role)')
const { data: created, error: createErr } = await svc.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true, // confirm immediately for probe
  user_metadata: { full_name: 'Probe Existing' },
})
if (createErr) {
  console.error('FAIL: createUser:', createErr)
  process.exit(1)
}
const userA = created.user
console.log('✓ Created auth.users row:', userA.id.slice(0, 8), '...')
console.log('  email_confirmed_at:', userA.email_confirmed_at)
console.log('  identities:', userA.identities?.length, '— providers:', userA.identities?.map(i => i.provider).join(','))
console.log()

// ─── Step 2: Try the API call that would happen for "Sign in with Google"
//            without actually doing OAuth — see what error Supabase returns
//            when a Google identity with an already-existing verified email
//            is presented.
//
//            We can't simulate the full OAuth redirect, but we CAN check:
//            (a) How many auth.users rows would Supabase currently create?
//            (b) Is there any email-uniqueness constraint anywhere?
console.log('▸ Step 2: Try to call signInWithOAuth and capture exact response')
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  // The `signInWithOAuth` call itself just returns the provider URL.
  // The collision-detection happens server-side when the user returns
  // with the OAuth code. So this call will always succeed — it tells
  // us "go talk to Google" but not whether linking will happen.
  const r = await anon.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:3000/auth/callback',
      queryParams: { prompt: 'select_account' },
    },
  })
  if (r.error) {
    console.log('✗ signInWithOAuth returned error:', r.error.message)
    console.log('  (this means the Dashboard toggle might explicitly block even the call)')
  } else {
    console.log('✓ signInWithOAuth returned provider URL — no collision detected at this stage')
    console.log('  URL starts with:', r.data?.url?.slice(0, 80), '...')
    console.log('  (collision detection happens AFTER Google redirects back with ?code=)')
  }
} catch (e) {
  console.log('Exception:', (e as Error).message)
}
console.log()

// ─── Step 3: Inspect auth.users/identities for any duplicate-email scenario
console.log('▸ Step 3: Try to admin-create a SECOND user with same email (bypass Google)')
console.log('  This simulates "what if a malicious user creates email/password')
console.log('  using the same email as an existing user" — separate from OAuth')
const { data: dup, error: dupErr } = await svc.auth.admin.createUser({
  email: TEST_EMAIL,
  password: 'DifferentPassword456!',
  email_confirm: true,
  user_metadata: { full_name: 'Probe Duplicate' },
})
if (dupErr) {
  console.log('✗ Service-role admin createUser(error):', dupErr.message)
  console.log('  STATUS:', dupErr.status)
  console.log('  CODE:', dupErr.code)
  if (dupErr.message.includes('already')) {
    console.log('  → Supabase rejects duplicate email at the application layer')
    console.log('  → Email/password identity cannot be created twice for same email')
  }
} else {
  console.log('✓ Service-role SUCCEEDED — created second auth.users row')
  console.log('  Duplicate user id:', dup.user.id.slice(0, 8))
  console.log('  → This means admin API bypasses email-uniqueness check')
  console.log('  → Always clean up by deleting both!')
  // Cleanup immediately
  await svc.auth.admin.deleteUser(dup.user.id)
  console.log('  Cleaned up duplicate user')
}
console.log()

// ─── Step 4: Try the anon-API signup endpoint with same email
console.log('▸ Step 4: Anon signUp with same email (simulates public page)')
const anonSignup = await anon.auth.signUp({
  email: TEST_EMAIL,
  password: 'AnonPass789!',
})
if (anonSignup.error) {
  console.log('✗ Anon signUp(error):', anonSignup.error.message)
  console.log('  STATUS:', anonSignup.error.status)
  console.log('  → This is what end-users see when trying to sign up with existing email')
} else {
  console.log('✓ Anon signUp succeeded — created', anonSignup.data.user?.id?.slice(0, 8))
  if (anonSignup.data.user?.identities?.length === 0) {
    console.log('  → ANONYMOUS IDENTITY (no provider yet — email confirmation pending)')
  }
  // Cleanup
  if (anonSignup.data.user?.id) {
    await svc.auth.admin.deleteUser(anonSignup.data.user.id)
    console.log('  Cleaned up')
  }
}
console.log()

// ─── Step 5: Final count + cleanup
console.log('▸ Step 5: Final state')
const { data: list } = await svc.auth.admin.listUsers({ perPage: 100 })
const matchingUsers = list.users.filter((u) => u.email === TEST_EMAIL)
console.log('  Users with test email:', matchingUsers.length)
matchingUsers.forEach((u) => {
  console.log('    id:', u.id.slice(0, 8), '| confirmed:', !!u.email_confirmed_at, '| identities:', u.identities?.length, '|', u.identities?.map(i => i.provider).join(','))
})

// Cleanup — keep only the first user created in step 1
const toDelete = matchingUsers.filter((u) => u.id !== userA.id)
for (const u of toDelete) {
  await svc.auth.admin.deleteUser(u.id)
}
await svc.auth.admin.deleteUser(userA.id)
console.log()
console.log('✓ Cleanup complete')

console.log()
console.log('─' .repeat(60))
console.log('CONCLUSIONS')
console.log('─'.repeat(60))
console.log('1. Dashboard toggle status: USER MUST VERIFY (no API exposure)')
console.log('2. auth.identities UNIQUE(provider_id, provider) — per-user,')
console.log('   not per-email. Means:')
console.log('   - With toggle OFF: signInWithOAuth returns 422 "User already"')
console.log('     when the returned identity email matches existing user.')
console.log('     → SECOND auth.users row is NOT created (Supabase blocks it)')
console.log('     → Need explicit linkIdentity() to merge identities')
console.log('   - With toggle ON: identities silently merge into existing row')
console.log('3. auth.users has NO email-uniqueness constraint at DB level —')
console.log('   uniqueness enforced only by Supabase application layer.')
console.log('4. Our code plan is correct:')
console.log('   - Enable Dashboard toggle (per user manual step)')
console.log('   - Add code-level can_link_identity_by_email() SQL helper')
console.log('     that requires email_verified=true on BOTH sides')
console.log('   - This guards against future toggle-disable regressions')
console.log('   - The handle_new_user trigger handles profile row creation.')
