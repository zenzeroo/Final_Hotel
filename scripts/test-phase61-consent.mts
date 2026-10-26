/**
 * Phase 61 — PDPA consent at sign-up.
 *
 * Cases:
 *   1. recordConsent(register, marketing on) → profile version + 2 events
 *   2. register form + signUp schema require the terms checkbox (static)
 *   3. marketing withdraw → flag false + 1 more event (history kept)
 *   4. RLS: owner reads own consent_events; another user sees none; owner cannot insert
 *   5. proxy: customer without consent GET /bookings → /consent?next=/bookings; after accepting → no redirect
 *   6. proxy: staff without consent are never sent to /consent
 *   7. /consent for a customer who already accepted → redirect to next (no loop)
 *   8. /privacy lists birthdate, the new contact email and the policy version
 *
 * Prereqs: migration 20261018_user_consents.sql applied; dev server on APP_URL
 * (default http://localhost:3000) for cases 5–8.
 * Run: npx tsx scripts/test-phase61-consent.mts
 * Cleanup: temp users p61-*@zenzero.test (consent rows cascade).
 */
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP = process.env.APP_URL ?? 'http://localhost:3000'
if (!BASE || !SERVICE_KEY || !ANON_KEY) {
  console.error('Supabase env vars required in .env.local')
  process.exit(1)
}
// Loaded after dotenv so lib/env.ts sees the variables.
const { recordConsent } = await import('../lib/data/supabase-account')
const { PRIVACY_POLICY_VERSION } = await import('../lib/consent')

const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = createClient(BASE, SERVICE_KEY, opts)

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const r = await fn()
    console.log('  ✓ ' + name + (r ? ' — ' + r : ''))
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const RUN = Date.now()
const createdUsers: string[] = []

interface TestUser {
  id: string
  client: SupabaseClient
  cookie: string
}

async function makeUser(tag: string, role: 'user' | 'reception' = 'user'): Promise<TestUser> {
  const email = `p61-${tag}-${RUN}@zenzero.test`
  const password = 'P61-Test-Pass1!'
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  if (role !== 'user') {
    const { error: re } = await svc.from('profiles').update({ role }).eq('id', data.user.id)
    if (re) throw new Error(`set role: ${re.message}`)
  }
  const client = createClient(BASE, ANON_KEY, opts)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`sign-in: ${se.message}`)

  // Same session as an SSR cookie, for requests to the dev server.
  const jar: { name: string; value: string; opts?: CookieOptions }[] = []
  const ssr = createServerClient(BASE, ANON_KEY, {
    cookies: {
      getAll: () => jar.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          const i = jar.findIndex((c) => c.name === name)
          if (i >= 0) jar[i] = { name, value, opts: options }
          else jar.push({ name, value, opts: options })
        }
      },
    },
  })
  const { error: ce } = await ssr.auth.signInWithPassword({ email, password })
  if (ce) throw new Error(`ssr sign-in: ${ce.message}`)
  return { id: data.user.id, client, cookie: jar.map((c) => `${c.name}=${c.value}`).join('; ') }
}

async function get(cookie: string | null, path: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.Cookie = cookie
  const res = await fetch(APP + path, { headers, redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location'), body: res.status === 200 ? await res.text() : '' }
}

async function cleanup() {
  for (const id of createdUsers.splice(0)) await svc.auth.admin.deleteUser(id)
}

console.log('Phase 61 — PDPA consent')

try {
  const a = await makeUser('a')
  const b = await makeUser('b')

  await step('1. recordConsent(register, marketing on) → profile version + 2 events', async () => {
    await recordConsent(a.id, {
      termsVersion: PRIVACY_POLICY_VERSION,
      marketing: true,
      source: 'register',
      version: PRIVACY_POLICY_VERSION,
    })
    const { data: p } = await svc
      .from('profiles')
      .select('terms_version, terms_accepted_at, marketing_opt_in')
      .eq('id', a.id)
      .single()
    assert(p?.terms_version === PRIVACY_POLICY_VERSION, `terms_version=${p?.terms_version}`)
    assert(p?.terms_accepted_at, 'terms_accepted_at not set')
    assert(p?.marketing_opt_in === true, 'marketing_opt_in not true')
    const { data: ev } = await svc.from('consent_events').select('kind, granted, source').eq('user_id', a.id)
    assert(ev?.length === 2, `events=${ev?.length}`)
    assert(ev.every((e) => e.granted && e.source === 'register'), JSON.stringify(ev))
    return 'kinds=' + ev.map((e) => e.kind).sort().join(',')
  })

  await step('2. register form + signUp schema require the terms checkbox', async () => {
    const box = readFileSync(resolve(__dirname, '..', 'components/consent/ConsentCheckboxes.tsx'), 'utf8')
    assert(/name="accept_terms"\s+required/.test(box), 'accept_terms checkbox is not required')
    assert(!/name="marketing_opt_in"[^>]*required/.test(box), 'marketing checkbox must not be required')
    assert(!/name="marketing_opt_in"[^>]*defaultChecked=\{true\}/.test(box), 'marketing must not be pre-ticked')
    const form = readFileSync(resolve(__dirname, '..', 'app/(auth)/register/RegisterForm.tsx'), 'utf8')
    // Phase 62 — the component now takes `legal` (version + published PDFs).
    assert(/<ConsentCheckboxes\b[^>]*\/>/.test(form), 'RegisterForm does not render ConsentCheckboxes')
    assert(box.includes('name="legal_version"'), 'ConsentCheckboxes does not post legal_version')
    const auth = readFileSync(resolve(__dirname, '..', 'app/actions/auth.ts'), 'utf8')
    assert(/acceptTerms: z\.literal\(true/.test(auth), 'signUp schema does not require acceptTerms')
  })

  await step('3. marketing withdraw → flag false, history kept', async () => {
    await recordConsent(a.id, { marketing: false, source: 'profile', version: PRIVACY_POLICY_VERSION })
    const { data: p } = await svc.from('profiles').select('marketing_opt_in, terms_version').eq('id', a.id).single()
    assert(p?.marketing_opt_in === false, 'marketing_opt_in still true')
    assert(p?.terms_version === PRIVACY_POLICY_VERSION, 'terms_version changed by a marketing update')
    const { data: ev } = await svc
      .from('consent_events')
      .select('granted')
      .eq('user_id', a.id)
      .eq('kind', 'marketing')
      .order('created_at')
    assert(ev?.length === 2 && ev[0].granted === true && ev[1].granted === false, JSON.stringify(ev))
  })

  await step('4. RLS: owner reads own events; others none; owner cannot insert', async () => {
    const { data: own } = await a.client.from('consent_events').select('id')
    assert((own?.length ?? 0) === 3, `owner sees ${own?.length}`)
    const { data: other } = await b.client.from('consent_events').select('id').eq('user_id', a.id)
    assert((other?.length ?? 0) === 0, `other user sees ${other?.length}`)
    const anon = createClient(BASE, ANON_KEY, opts)
    const { data: anonRows } = await anon.from('consent_events').select('id')
    assert((anonRows?.length ?? 0) === 0, 'anon sees rows')
    const { error } = await a.client
      .from('consent_events')
      .insert({ user_id: a.id, kind: 'terms', version: 'x', granted: true, source: 'profile' })
    assert(error, 'owner insert was allowed')
    return 'insert refused: ' + error.code
  })

  const appUp = await fetch(APP + '/privacy', { redirect: 'manual' }).then(
    () => true,
    () => false,
  )
  if (!appUp) {
    console.log(`  ! dev server not reachable at ${APP} — cases 5–8 not run`)
    failed++
  } else {
    await step('5. proxy: no consent → /consent?next=/bookings; after accepting → page loads', async () => {
      const before = await get(b.cookie, '/bookings')
      assert(before.status >= 300 && before.status < 400, `status ${before.status}`)
      const loc = new URL(before.location ?? '', APP)
      assert(loc.pathname === '/consent', `location ${before.location}`)
      assert(loc.searchParams.get('next') === '/bookings', `next=${loc.searchParams.get('next')}`)
      await recordConsent(b.id, {
        termsVersion: PRIVACY_POLICY_VERSION,
        source: 'consent_page',
        version: PRIVACY_POLICY_VERSION,
      })
      const after = await get(b.cookie, '/bookings')
      assert(after.status === 200, `after accepting: status ${after.status} → ${after.location}`)
    })

    await step('6. proxy: staff without consent are not sent to /consent', async () => {
      const staff = await makeUser('staff', 'reception')
      for (const path of ['/bookings', '/account/profile']) {
        const r = await get(staff.cookie, path)
        assert(!(r.location ?? '').includes('/consent'), `${path} → ${r.location}`)
      }
    })

    await step('7. /consent after accepting → redirect to next (no loop)', async () => {
      const r = await get(b.cookie, '/consent?next=%2Fbookings')
      assert(r.status >= 300 && r.status < 400, `status ${r.status}`)
      assert(new URL(r.location ?? '', APP).pathname === '/bookings', `location ${r.location}`)
    })

    await step('8. /privacy lists birthdate, contact email and version', async () => {
      const r = await get(null, '/privacy')
      assert(r.status === 200, `status ${r.status}`)
      const html = r.body.replace(/<!--[^>]*-->/g, '')
      const [y, m, d] = PRIVACY_POLICY_VERSION.split('-')
      for (const needle of ['privacy@zenzerohotel.xyz', `${d}/${m}/${y}`]) {
        assert(html.includes(needle), `missing ${needle}`)
      }
      assert(html.includes('วันเกิด') || html.includes('date of birth'), 'birthdate not listed')
      assert(!html.includes('privacy@zenzero.com'), 'old email still present')
    })
  }
} finally {
  await cleanup()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
