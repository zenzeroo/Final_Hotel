// =========================================================
// scripts/_db-connection.mjs — shared Postgres connection helper
// =========================================================
//
// Phase 12 — eliminates hardcoded Supabase pooler region + DB password
// from 7 scripts (promote-manager, query-manager-id, check-enum,
// check-target, run-add-manager-enum, run-sql, check-cols).
//
// Reads from `.env.local` at the project root:
//   - NEXT_PUBLIC_SUPABASE_URL  (project ref → host derivation)
//   - SUPABASE_POOLER_HOST      (default: ap-southeast-1 pooler)
//   - SUPABASE_DB_PASSWORD      (required; the DB user's password)
//
// Exports:
//   - pgPoolerConfig()           — pooler (Transaction mode) pg.Client config
//   - pgDirectConnectionString() — direct host connection string (port 5432)
//                                  with URL-encoded password
//
// Pooler port is 6543 (Transaction mode) — works for one-shot scripts that
// don't hold a session open across queries.
// =========================================================
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_POOLER_HOST =
  process.env.SUPABASE_POOLER_HOST ?? 'aws-0-ap-southeast-1.pooler.supabase.com'
const SUPABASE_POOLER_PORT = 6543

const SUPABASE_DIRECT_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local')
  const m = url.match(/^https:\/\/([^.]+)\.supabase\.co$/)
  if (!m) throw new Error(`Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL=${url}`)
  return `db.${m[1]}.supabase.co`
})()

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD ?? ''

if (!DB_PASSWORD) {
  console.error('⚠ SUPABASE_DB_PASSWORD missing from .env.local — DB queries will fail')
}

/**
 * Pooler (Transaction mode) client config. Use for one-shot scripts that
 * issue a small number of queries then exit.
 */
export function pgPoolerConfig() {
  const ref = SUPABASE_DIRECT_HOST.split('.')[1] // db.<ref>.supabase.co → <ref>
  return {
    host: SUPABASE_POOLER_HOST,
    port: SUPABASE_POOLER_PORT,
    database: 'postgres',
    user: `postgres.${ref}`,
    password: DB_PASSWORD,
  }
}

/**
 * Direct host (port 5432) connection string with URL-encoded password.
 * Use with scripts that need a long-lived session or SSL + CA bundle
 * (e.g. check-cols).
 */
export function pgDirectConnectionString() {
  return `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@${SUPABASE_DIRECT_HOST}:5432/postgres`
}
