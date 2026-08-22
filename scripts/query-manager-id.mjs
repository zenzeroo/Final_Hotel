// One-off: print manager user ids from Supabase.
// Usage: node scripts/query-manager-id.mjs
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local')
  process.exit(1)
}

const projectRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]
const client = new pg.Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: DB_PASSWORD,
})

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
