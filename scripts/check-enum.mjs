import pg from 'pg'
import { pgPoolerConfig } from './_db-connection.mjs'

const c = new pg.Client(pgPoolerConfig())

await c.connect()
const r = await c.query(`select enumlabel from pg_enum where enumtypid = 'public.user_role'::regtype order by enumsortorder`)
console.log('user_role enum values:', r.rows.map(x => x.enumlabel).join(', '))

const p = await c.query(`select id, full_name, role from public.profiles order by role, full_name`)
console.log('\nAll profiles:')
p.rows.forEach(x => console.log(`  [${x.role.padEnd(11)}] ${x.id}  ${x.full_name ?? '—'}`))
await c.end()
