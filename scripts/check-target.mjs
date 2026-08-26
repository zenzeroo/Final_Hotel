import pg from 'pg'
import { pgPoolerConfig } from './_db-connection.mjs'

const c = new pg.Client(pgPoolerConfig())

const targetId = '862ca949-75de-4b32-a1e1-5df80f973ddd'

await c.connect()

// 1. Check if this UID exists in auth.users
const { rows: authRows } = await c.query(
  `select id, email, created_at, confirmed_at from auth.users where id = $1`,
  [targetId],
)
console.log('-- auth.users row for', targetId, '--')
if (authRows.length === 0) {
  console.log('  ❌ NOT FOUND in auth.users')
} else {
  const r = authRows[0]
  console.log(`  email       = ${r.email}`)
  console.log(`  confirmed   = ${r.confirmed_at ? 'yes' : 'no'}`)
  console.log(`  created_at  = ${r.created_at}`)
}

// 2. Check if profile exists for this UID
const { rows: profRows } = await c.query(
  `select id, full_name, role from public.profiles where id = $1`,
  [targetId],
)
console.log('\n-- public.profiles row --')
if (profRows.length === 0) {
  console.log('  ❌ NOT FOUND in public.profiles (need to insert one)')
} else {
  const r = profRows[0]
  console.log(`  full_name = ${r.full_name ?? '—'}`)
  console.log(`  role      = ${r.role}`)
}

// 3. List ALL auth.users with no matching profile (orphaned)
const { rows: orphans } = await c.query(`
  select au.id, au.email, au.created_at
  from auth.users au
  left join public.profiles p on p.id = au.id
  where p.id is null
`)
console.log('\n-- auth.users with NO profile row --')
if (orphans.length === 0) {
  console.log('  (none)')
} else {
  orphans.forEach((r) => console.log(`  ${r.id}  ${r.email}  ${r.created_at}`))
}

await c.end()
