import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = url.replace(/^https?:\/\//, '').split('.')[0]
const c = new pg.Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: `postgres.${ref}`,
  password: process.env.SUPABASE_DB_PASSWORD,
})

const MANAGER_ID = 'ba4b825d-3dec-4db0-b604-82f20c8cb165'

await c.connect()

// 1. Verify auth.users row
const { rows: authRows } = await c.query(
  `select id, email, confirmed_at from auth.users where id = $1`,
  [MANAGER_ID],
)
if (authRows.length === 0) {
  console.error('❌ UID not found in auth.users — double-check Supabase Auth dashboard')
  await c.end()
  process.exit(1)
}
const u = authRows[0]
console.log(`auth.users: ${u.email}  (confirmed: ${u.confirmed_at ? 'yes' : 'NO'})`)

// 2. Create profile row if missing
const { rows: profRows } = await c.query(
  `select id, full_name, role from public.profiles where id = $1`,
  [MANAGER_ID],
)
if (profRows.length === 0) {
  console.log('No profile row yet — creating one...')
  await c.query(
    `insert into public.profiles (id, full_name, role) values ($1, $2, 'manager')`,
    [MANAGER_ID, 'Manager'],
  )
  console.log('  ✓ profile created with role=manager')
} else {
  console.log(`Existing profile: ${profRows[0].full_name ?? '—'}  role=${profRows[0].role}`)
  if (profRows[0].role !== 'manager') {
    console.log('Promoting to manager...')
    await c.query(`update public.profiles set role = 'manager' where id = $1`, [MANAGER_ID])
    console.log('  ✓ role updated to manager')
  } else {
    console.log('  ✓ already manager — no change needed')
  }
}

// 3. Verify
const { rows: verify } = await c.query(
  `select id, full_name, role, created_at from public.profiles where id = $1`,
  [MANAGER_ID],
)
console.log('\n✅ Final state:')
console.log(`  id        = ${verify[0].id}`)
console.log(`  full_name = ${verify[0].full_name ?? '—'}`)
console.log(`  role      = ${verify[0].role}`)
console.log(`  created   = ${verify[0].created_at}`)

console.log(`\n👉 Manager login: ${u.email} / (password you set in dashboard)`)

await c.end()
