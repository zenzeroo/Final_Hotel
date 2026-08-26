// One-off: print manager user ids from Supabase.
// Usage: node scripts/query-manager-id.mjs
import pg from 'pg'
import { pgPoolerConfig } from './_db-connection.mjs'

const client = new pg.Client(pgPoolerConfig())

async function main() {
  await client.connect()
  console.log('-- All manager users --')
  const { rows: managers } = await client.query(`
    select id, full_name, role, created_at
    from public.profiles
    where role = 'manager'
    order by created_at
  `)
  if (managers.length === 0) {
    console.log('(no managers yet — run migration + promote a user first)')
  } else {
    managers.forEach((r) => {
      console.log(`id     = ${r.id}`)
      console.log(`name   = ${r.full_name ?? '(none)'}`)
      console.log(`role   = ${r.role}`)
      console.log(`created= ${r.created_at}`)
      console.log('---')
    })
  }

  console.log('\n-- All users (for promoting to manager) --')
  const { rows: users } = await client.query(`
    select id, full_name, role
    from public.profiles
    order by case role
      when 'manager' then 0 when 'admin' then 1 when 'reception' then 2
      when 'housekeeper' then 3 else 4 end, full_name
    limit 50
  `)
  users.forEach((r) => console.log(`  [${r.role.padEnd(11)}] ${r.id}  ${r.full_name ?? '—'}`))

  await client.end()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
