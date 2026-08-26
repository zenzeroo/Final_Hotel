#!/usr/bin/env node
/**
 * Phase 9 final — apply Phase 9 migrations to the live Supabase DB.
 *
 * Usage:
 *   node scripts/run-migrations.mjs                    # apply all 4 phase-9 migrations
 *   node scripts/run-migrations.mjs --only=20260832    # apply one
 *   node scripts/run-migrations.mjs --dry-run          # print plan only
 *
 * Reads SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL from .env.local
 * and constructs the connection string. Tracks applied migrations in a
 * `_applied_migrations` table — re-running is a no-op.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import { Client } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD
if (!SUPABASE_URL) {
  console.error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local')
  process.exit(1)
}
if (!DB_PASSWORD) {
  console.error('SUPABASE_DB_PASSWORD missing from .env.local')
  process.exit(1)
}

// Extract project ref from URL: https://toogwfpzoayioedsiqdj.supabase.co → toogwfpzoayioedsiqdj
const m = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
if (!m) {
  console.error('Could not parse project ref from SUPABASE_URL:', SUPABASE_URL)
  process.exit(1)
}
const projectRef = m[1]
const connStr = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyArg = args.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length) : null

const migrationsDir = resolve(__dirname, '..', 'supabase', 'migrations')
// Apply Phase 9 migrations (20260827–32).
// NOTE: 20260827 (reviews RLS + status column) is a fix-up: code in phase 9D
// references review status / moderated_at columns that the live DB never
// received. Without it, the reviews wire fails at runtime.
const allFiles = readdirSync(migrationsDir)
  .filter((f) => /202608(27|29|30|31|32|33|34)_.*\.sql$/.test(f))
  .sort()
const targets = only ? allFiles.filter((f) => f.includes(only)) : allFiles

console.log('Phase 9 + Phase 10 migrations to apply:')
for (const f of targets) console.log('  • ' + f)
if (dryRun) {
  console.log('\nDRY RUN — exiting without applying.')
  process.exit(0)
}

// Supabase's PostgreSQL endpoint uses a custom CA chain ("Supabase Root
// 2021 CA") that isn't in Node's default trust store. We pin to a bundle
// captured from the live endpoint and committed alongside this script.
const caPath = resolve(__dirname, '.supabase-ca.crt')
const ca = readFileSync(caPath, 'utf8')
const client = new Client({ connectionString: connStr, ssl: { ca } })

async function main() {
  await client.connect()
  console.log('\nConnected to db.' + projectRef + '.supabase.co')

  // Track applied migrations.
  await client.query(`
    create table if not exists public._applied_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `)

  const { rows: applied } = await client.query('select name from public._applied_migrations')
  const appliedSet = new Set(applied.map((r) => r.name))
  console.log('Already applied:', appliedSet.size === 0 ? '(none)' : [...appliedSet].join(', '))

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const file of targets) {
    if (appliedSet.has(file)) {
      console.log('  ⊙ ' + file + ' — already applied, skipping')
      skipped++
      continue
    }
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
    console.log('  ▶ ' + file + ' — applying...')
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into public._applied_migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log('  ✓ ' + file + ' — applied')
      ok++
    } catch (e) {
      await client.query('rollback').catch(() => {})
      console.error('  ✗ ' + file + ' — FAILED:', e.message)
      failed++
      // Continue to next migration — many are idempotent and a single
      // failure shouldn't block the rest. But stop if it's a hard error.
    }
  }

  await client.end()
  console.log('\nDone. ok=' + ok + ', skipped=' + skipped + ', failed=' + failed)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
