/**
 * Create test admin user for Phase 7 smoke tests.
 * Ensures admin@zenzero.com exists with role='admin' in profiles.
 *
 * Idempotent: skips users that already exist.
 *
 * Usage: node scripts/create-test-admin.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'admin@zenzero.com'
const PASSWORD = 'AdminPass123!'
const FULL_NAME = 'Zenzero Admin'

async function main() {
  console.log(`🚀 Ensuring admin user in ${SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1]}`)

  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = existing?.users?.find((u) => u.email === EMAIL)

  let userId
  if (found) {
    console.log(`✓ User exists: ${EMAIL} (${found.id})`)
    userId = found.id
    // Reset password to known value (so smoke tests can log in)
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
    })
    if (pwdErr) {
      console.error('⚠ Failed to reset password:', pwdErr.message)
    } else {
      console.log(`✓ Password reset to "${PASSWORD}"`)
    }
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    })
    if (createErr || !created.user) {
      console.error('❌ Failed to create admin:', createErr?.message)
      process.exit(1)
    }
    console.log(`✓ Created user: ${EMAIL} (${created.user.id})`)
    userId = created.user.id
  }

  // Promote role in profiles table (handle_new_user() trigger may have created profile as 'user')
  const { error: roleErr } = await supabase
    .from('profiles')
    .update({ role: 'admin', full_name: FULL_NAME })
    .eq('id', userId)

  if (roleErr) {
    console.error('❌ Failed to set role:', roleErr.message)
    process.exit(1)
  }

  // Verify
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single()

  console.log('\n✅ Final state:')
  console.log(`  id        = ${profile?.id}`)
  console.log(`  full_name = ${profile?.full_name}`)
  console.log(`  role      = ${profile?.role}`)
  console.log(`\n👉 Admin login: ${EMAIL} / ${PASSWORD}`)
}

main().catch((err) => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
