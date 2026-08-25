/**
 * One-shot fixture setup for Phase 11 RBAC test.
 *  - Reset test@zenzero.com → role='user'
 *  - Create reception@zenzero.com (idempotent)
 * Run: npx tsx scripts/_rbac-fixture.mts
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// 1. Reset test@zenzero.com → role='user'
{
  const { data: users } = await svc.auth.admin.listUsers()
  const u = users?.users.find((x) => x.email === 'test@zenzero.com')
  if (u) {
    const { error } = await svc.from('profiles').update({ role: 'user' }).eq('id', u.id)
    if (error) console.error('reset test role:', error.message)
    else console.log('✓ test@zenzero.com → role=user')
  }
}

// 2. Create or update reception@zenzero.com
{
  const { data: users } = await svc.auth.admin.listUsers()
  let u = users?.users.find((x) => x.email === 'reception@zenzero.com')
  if (!u) {
    const { data, error } = await svc.auth.admin.createUser({
      email: 'reception@zenzero.com',
      password: 'ReceptionPass123!',
      email_confirm: true,
      user_metadata: { full_name: 'Malee Reception' },
    })
    if (error) {
      console.error('create reception:', error.message)
    } else {
      u = data.user!
      console.log('✓ created reception@zenzero.com (' + u.id.slice(0, 8) + ')')
    }
  } else {
    console.log('✓ reception@zenzero.com exists (' + u.id.slice(0, 8) + ')')
  }
  if (u) {
    const { error } = await svc.from('profiles').update({ role: 'reception' }).eq('id', u.id)
    if (error) console.error('set reception role:', error.message)
    else console.log('✓ reception@zenzero.com → role=reception')
  }
}