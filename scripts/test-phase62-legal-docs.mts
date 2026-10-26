/**
 * Phase 62 — admin-uploaded legal documents (PDF) + DB-driven consent version.
 *
 * Cases:
 *   1. no legal_versions rows → consent version = PRIVACY_POLICY_VERSION (fallback)
 *   2. admin fills the draft + publish_legal_version() → consent version = new row's version
 *   3. customer who accepted the fallback version: GET /bookings → /consent?next=/bookings
 *   4. after accepting the new version → GET /bookings loads
 *   5. staff without consent are never sent to /consent
 *
 * Prereqs: migration 20261019_legal_documents.sql applied; dev server on APP_URL
 * (default http://localhost:3000) for cases 3–5.
 * Run: npx tsx scripts/test-phase62-legal-docs.mts
 * Cleanup: temp users p62-*@zenzero.test, the test legal_versions rows
 * (privacy_th_key like 'legal/p62-%') and the draft slots.
 */
import { config as loadEnv } from 'dotenv'
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
const { PRIVACY_POLICY_VERSION, consentVersionOf } = await import('../lib/consent')
const { fetchCurrentLegalVersion } = await import('../lib/legal/current')
const { r2Client, R2_BUCKET } = await import('../lib/r2/client')
const { deleteObjectFromR2 } = await import('../lib/r2/delete')
const { PutObjectCommand } = await import('@aws-sdk/client-s3')
const { uploadPdfToR2, LegalPdfError, deleteLegalObjectIfUnpublished } = await import('../lib/r2/upload-pdf')
const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
async function r2Exists(key: string): Promise<boolean> {
  try {
    await r2Client!.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// Smallest valid-looking PDF body; the route only streams bytes.
const TINY_PDF = new TextEncoder().encode('%PDF-1.4\n%p62 test\n%%EOF\n')
const r2Keys: string[] = []
async function putTestPdf(key: string) {
  if (!r2Client) throw new Error('R2 not configured')
  await r2Client.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: TINY_PDF, ContentType: 'application/pdf' }),
  )
  r2Keys.push(key)
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = createClient(BASE, SERVICE_KEY, opts)
const anon = createClient(BASE, ANON_KEY, opts)

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

async function makeUser(tag: string, role: 'user' | 'reception' | 'admin' = 'user'): Promise<TestUser> {
  const email = `p62-${tag}-${RUN}@zenzero.test`
  const password = 'P62-Test-Pass1!'
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
  return { status: res.status, location: res.headers.get('location'), res }
}

async function cleanup() {
  for (const key of r2Keys.splice(0)) await deleteObjectFromR2(key).catch(() => {})
  await svc.from('legal_versions').delete().like('privacy_th_key', 'legal/p62-%')
  await svc
    .from('legal_draft')
    .update({ privacy_th_key: null, privacy_en_key: null, terms_th_key: null, terms_en_key: null })
    .eq('id', 1)
  for (const id of createdUsers.splice(0)) await svc.auth.admin.deleteUser(id)
}

console.log('Phase 62 — legal documents')

try {
  const { count } = await svc.from('legal_versions').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    console.log('  ! legal_versions already has rows — cases 1 and 3 assume the fallback; aborting')
    process.exit(1)
  }

  const admin = await makeUser('admin', 'admin')
  const cust = await makeUser('cust')
  await recordConsent(cust.id, {
    termsVersion: PRIVACY_POLICY_VERSION,
    source: 'consent_page',
    version: PRIVACY_POLICY_VERSION,
  })

  await step('1. no published version → fallback consent version', async () => {
    const row = await fetchCurrentLegalVersion(anon)
    assert(row === null, 'expected no row')
    assert(consentVersionOf(row) === PRIVACY_POLICY_VERSION, `version=${consentVersionOf(row)}`)
  })

  let published = ''
  let publishedId = ''
  await step('2. admin publishes the draft → consent version = new version', async () => {
    for (const d of ['pth', 'pen', 'tth', 'ten']) await putTestPdf(`legal/p62-${RUN}-${d}.pdf`)
    const { error: de } = await admin.client
      .from('legal_draft')
      .update({
        privacy_th_key: `legal/p62-${RUN}-pth.pdf`,
        privacy_en_key: `legal/p62-${RUN}-pen.pdf`,
        terms_th_key: `legal/p62-${RUN}-tth.pdf`,
        terms_en_key: `legal/p62-${RUN}-ten.pdf`,
      })
      .eq('id', 1)
    assert(!de, `draft update: ${de?.message}`)
    const { data, error } = await admin.client.rpc('publish_legal_version')
    assert(!error, `publish: ${error?.message}`)
    published = (data as { version: string }).version
    publishedId = (data as { id: string }).id
    const row = await fetchCurrentLegalVersion(anon)
    assert(row?.version === published, `current=${row?.version}`)
    assert(row.keys['terms-en'] === `legal/p62-${RUN}-ten.pdf`, `keys=${JSON.stringify(row.keys)}`)
    assert(consentVersionOf(row) === published, 'consentVersionOf mismatch')
    return published
  })

  await step('9. uploadPdfToR2 stores a real PDF under legal/<uuid>.pdf', async () => {
    const key = await uploadPdfToR2(new File([TINY_PDF], 'privacy.pdf', { type: 'application/pdf' }))
    r2Keys.push(key)
    assert(/^legal\/[0-9a-f-]{36}\.pdf$/.test(key), `key=${key}`)
    return key
  })

  await step('10. uploadPdfToR2 rejects a .docx renamed to .pdf', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    try {
      await uploadPdfToR2(new File([zip], 'terms.pdf', { type: 'application/pdf' }))
    } catch (e) {
      assert(e instanceof LegalPdfError && e.reason === 'magic', `wrong error: ${(e as Error).message}`)
      return 'rejected: magic'
    }
    throw new Error('upload was accepted')
  })

  await step('11. set_legal_draft_key swaps one slot atomically and returns the old key (admin only)', async () => {
    const first = await admin.client.rpc('set_legal_draft_key', { p_doc: 'terms-th', p_key: `legal/p62-${RUN}-swap1.pdf` })
    assert(!first.error, `rpc: ${first.error?.message}`)
    assert(first.data === null, `old key should be null, got ${first.data}`)
    const second = await admin.client.rpc('set_legal_draft_key', { p_doc: 'terms-th', p_key: null })
    assert(second.data === `legal/p62-${RUN}-swap1.pdf`, `old key=${second.data}`)
    const forbidden = await cust.client.rpc('set_legal_draft_key', { p_doc: 'terms-th', p_key: 'x' })
    assert(forbidden.error?.message.includes('FORBIDDEN'), `customer: ${forbidden.error?.message}`)
    const bad = await admin.client.rpc('set_legal_draft_key', { p_doc: 'nope', p_key: 'x' })
    assert(bad.error, 'unknown doc accepted')
  })

  await step('12. a published object is never deleted as a stale draft; an unpublished one is', async () => {
    const published = `legal/p62-${RUN}-pth.pdf` // in the version published by case 2
    const deletedPublished = await deleteLegalObjectIfUnpublished(anon, published)
    assert(deletedPublished === false, 'reported deleting a published object')
    assert(await r2Exists(published), 'published object was deleted')
    const orphan = `legal/p62-${RUN}-orphan.pdf`
    await putTestPdf(orphan)
    const deletedOrphan = await deleteLegalObjectIfUnpublished(anon, orphan)
    assert(deletedOrphan === true && !(await r2Exists(orphan)), 'unpublished object was kept')
  })

  const appUp = await fetch(APP + '/privacy', { redirect: 'manual' }).then(
    () => true,
    () => false,
  )
  if (!appUp) {
    console.log(`  ! dev server not reachable at ${APP} — cases 3–5 not run`)
    failed++
  } else {
    await step('3. customer on the old version → /consent?next=/bookings', async () => {
      const r = await get(cust.cookie, '/bookings')
      assert(r.status >= 300 && r.status < 400, `status ${r.status}`)
      const loc = new URL(r.location ?? '', APP)
      assert(loc.pathname === '/consent', `location ${r.location}`)
      assert(loc.searchParams.get('next') === '/bookings', `next=${loc.searchParams.get('next')}`)
    })

    await step('4. after accepting the new version → /bookings loads', async () => {
      await recordConsent(cust.id, { termsVersion: published, source: 'consent_page', version: published })
      const r = await get(cust.cookie, '/bookings')
      assert(r.status === 200, `status ${r.status} → ${r.location}`)
    })

    await step('5. staff without consent are not sent to /consent', async () => {
      const staff = await makeUser('staff', 'reception')
      const r = await get(staff.cookie, '/bookings')
      assert(!(r.location ?? '').includes('/consent'), `→ ${r.location}`)
    })

    await step('6. /legal-files/<doc>?v=<published id> streams the PDF', async () => {
      const r = await get(null, `/legal-files/terms-en?v=${publishedId}`)
      assert(r.status === 200, `status ${r.status}`)
      assert(r.res.headers.get('content-type') === 'application/pdf', `type ${r.res.headers.get('content-type')}`)
      assert((r.res.headers.get('cache-control') ?? '').includes('immutable'), 'not immutable')
      const body = new Uint8Array(await r.res.arrayBuffer())
      assert(new TextDecoder().decode(body.slice(0, 5)) === '%PDF-', 'body is not a PDF')
    })

    await step('7. ?v=draft is admin only', async () => {
      await putTestPdf(`legal/p62-${RUN}-draft.pdf`)
      await svc.from('legal_draft').update({ privacy_th_key: `legal/p62-${RUN}-draft.pdf` }).eq('id', 1)
      const anonRes = await get(null, '/legal-files/privacy-th?v=draft')
      assert(anonRes.status === 403, `anon status ${anonRes.status}`)
      const custRes = await get(cust.cookie, '/legal-files/privacy-th?v=draft')
      assert(custRes.status === 403, `customer status ${custRes.status}`)
      const adminRes = await get(admin.cookie, '/legal-files/privacy-th?v=draft')
      assert(adminRes.status === 200, `admin status ${adminRes.status}`)
      assert(adminRes.res.headers.get('cache-control') === 'no-store', 'draft must be no-store')
    })

    await step('8. unknown doc / unknown version → 404', async () => {
      const a = await get(null, `/legal-files/nope?v=${publishedId}`)
      assert(a.status === 404, `bad doc status ${a.status}`)
      const b = await get(null, '/legal-files/terms-en?v=00000000-0000-4000-8000-000000000000')
      assert(b.status === 404, `bad version status ${b.status}`)
      const c = await get(null, '/legal-files/terms-en?v=not-a-uuid')
      assert(c.status === 404, `non-uuid status ${c.status}`)
    })
  }
} finally {
  await cleanup()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
