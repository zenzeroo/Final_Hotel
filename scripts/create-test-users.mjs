/**
 * Create test users for housekeeper role via Supabase Admin API.
 * Creates users in auth.users and sets profiles.role='housekeeper'.
 *
 * Usage: node scripts/create-test-users.mjs
 *
 * Idempotent: skips users that already exist.
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
loadEnv({ path: resolve(ROOT, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { email: 'somjit@zenzero.com', password: 'Housekeep123!', fullName: 'Somjit', role: 'housekeeper' },
  { email: 'niran@zenzero.com', password: 'Housekeep123!', fullName: 'Niran', role: 'housekeeper' },
]

async function ensureUser({ email, password, fullName, role }) {
  // Check if user already exists in auth.users
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = existing?.users?.find(u => u.email === email)

  let userId
  if (found) {
    console.log(`✓ User exists: ${email} (${found.id})`)
    userId = found.id
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !created.user) {
      console.error(`❌ Failed to create ${email}:`, createErr?.message)
      return false
    }
    console.log(`✓ Created user: ${email} (${created.user.id})`)
    userId = created.user.id
  }

  // Promote role in profiles table (trigger auto-creates profile on signup, but role defaults to 'user')
  const { error: roleErr } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (roleErr) {
    console.error(`❌ Failed to set role for ${email}:`, roleErr.message)
    return false
  }
  console.log(`✓ Set role='${role}' for ${email}`)
  return true
}

async function main() {
  console.log(`🚀 Creating housekeeper test users in ${SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1]}`)
  let allOk = true
  for (const u of USERS) {
    const ok = await ensureUser(u)
    if (!ok) allOk = false
  }
  if (allOk) {
    console.log('\n✅ All users ready. Test login with:')
    USERS.forEach(u => console.log(`   ${u.email} / ${u.password}`))
  } else {
    console.log('\n⚠️  Some operations failed — check above')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})