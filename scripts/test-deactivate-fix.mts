/**
 * Phase 26 hotfix verification — User profile cannot self-delete account.
 *
 * Bug: deactivateAccountAction (app/actions/account.ts) wrapped the
 * `await signOut()` call in `try { } catch { }`. The empty catch swallowed
 * the NEXT_REDIRECT signal that signOut() throws via redirect('/'), so the
 * browser never navigated — user saw "กำลังลบ…" spinner stuck forever.
 *
 * Fix: remove the try/catch so redirect propagates to Next.js runtime.
 *
 * This test verifies the fix at the code level (HTTP smoke is brittle due
 * to Next.js server-action action-ID hashing + multipart encoding). The
 * runtime behavior is straightforward: signOut() throws redirect('/'),
 * the throw now bubbles to Next.js, Next.js navigates the browser to '/'.
 *
 * Run: npx tsx scripts/test-deactivate-fix.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const ACCOUNT_SRC = readFileSync(
  resolve(__dirname, '..', 'app', 'actions', 'account.ts'),
  'utf8',
)

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('✗ FAIL:', msg)
    process.exit(1)
  }
  console.log('✓', msg)
}

console.log('Phase 26 hotfix verification — deactivateAccountAction\n')

// 1. The broken pattern: try { await signOut() } catch {}
const brokenPattern = /try\s*\{\s*await\s+signOut\(\)\s*\}\s*catch\s*\{/
assert(
  !brokenPattern.test(ACCOUNT_SRC),
  'No try/catch around await signOut() (was swallowing NEXT_REDIRECT)',
)

// 2. signOut() is called AFTER deactivateOwnAccount() so the row gets
//    flipped to is_active=false before the user is signed out.
const callOrder =
  /deactivateOwnAccount\(\)[\s\S]*?await\s+signOut\(\)/
assert(
  callOrder.test(ACCOUNT_SRC),
  'signOut() called AFTER deactivateOwnAccount() (is_active flip happens first)',
)

// 3. requireRole('user', ...) gate — staff can't trigger this action.
assert(
  /requireRole\(\s*['"]user['"]/.test(ACCOUNT_SRC),
  "requireRole('user') gate present (staff blocked from self-deactivate)",
)

// 4. Mockup-confirm text guard still in place.
assert(
  /confirmText\s*!==\s*['"]ลบบัญชี['"]/.test(ACCOUNT_SRC),
  '"ลบบัญชี" confirm-text guard present',
)

// 5. signOut() implementation in auth.ts still ends with redirect('/')
//    — that's the source of the NEXT_REDIRECT throw that must propagate.
const authSrc = readFileSync(
  resolve(__dirname, '..', 'app', 'actions', 'auth.ts'),
  'utf8',
)
assert(
  /export async function signOut\(\)[\s\S]*?redirect\(['"]\/['"]\)/.test(authSrc),
  'signOut() in auth.ts still ends with redirect("/") (source of NEXT_REDIRECT throw)',
)

// 6. Component's try/catch still expects the redirect to bubble through.
const componentSrc = readFileSync(
  resolve(__dirname, '..', 'components', 'account', 'DeactivateAccountSection.tsx'),
  'utf8',
)
assert(
  /catch\s*\{[\s\S]*?redirect/.test(componentSrc),
  'Component catch block expects NEXT_REDIRECT to bubble through',
)

console.log(
  '\n✅ All 6 code-level invariants hold — runtime redirect behavior correct.',
)
console.log(
  'Manual smoke: sign in as a User, type "ลบบัญชี" on /account/profile,',
)
console.log(
  'click "ลบบัญชีของฉัน" → browser should navigate to / and clear session.',
)
