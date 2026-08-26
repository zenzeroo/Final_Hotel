// =========================================================
// scripts/check-cols.mjs — print the columns of public.reviews
// (Phase 12: password literal removed; uses shared DB helper.)
// =========================================================
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { pgDirectConnectionString } from './_db-connection.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const c = new pg.Client({
  connectionString: pgDirectConnectionString(),
  ssl: { ca: readFileSync(resolve(__dirname, '.supabase-ca.crt'), 'utf8') },
})
await c.connect()
const { rows } = await c.query(`
  select column_name, data_type from information_schema.columns
  where table_schema='public' and table_name='reviews'
  order by ordinal_position
`)
console.log('reviews columns:', rows.map((r) => r.column_name).join(', '))
await c.end()
