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

await c.connect()
const r = await c.query(`select enumlabel from pg_enum where enumtypid = 'public.user_role'::regtype order by enumsortorder`)
console.log('user_role enum values:', r.rows.map(x => x.enumlabel).join(', '))

const p = await c.query(`select id, full_name, role from public.profiles order by role, full_name`)
console.log('\nAll profiles:')
p.rows.forEach(x => console.log(`  [${x.role.padEnd(11)}] ${x.id}  ${x.full_name ?? '—'}`))
await c.end()
