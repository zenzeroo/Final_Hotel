import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

import pg from 'pg'
const { Client } = pg
const fs = await import('node:fs')

const c = new Client({
  connectionString: 'postgresql://postgres:ZvgVU7ijs5i0L60d@db.toogwfpzoayioedsiqdj.supabase.co:5432/postgres',
  ssl: { ca: fs.readFileSync(resolve(__dirname, '.supabase-ca.crt'), 'utf8') },
})
await c.connect()
const { rows } = await c.query(`
  select column_name, data_type from information_schema.columns
  where table_schema='public' and table_name='reviews'
  order by ordinal_position
`)
console.log('reviews columns:', rows.map((r) => r.column_name).join(', '))
await c.end()
