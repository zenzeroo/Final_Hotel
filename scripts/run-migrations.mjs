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
// Apply Phase 9–20 migrations (20260827–34 + 20260902–05).
// NOTE: 20260827 (reviews RLS + status column) is a fix-up: code in phase 9D
// references review status / moderated_at columns that the live DB never
// received. Without it, the reviews wire fails at runtime.
// 20260902 adds Phase 17 (Stripe payments table + 3 SECURITY DEFINER RPCs).
// 20260903 adds Phase 18 (confirm_refund_session RPC for charge.refunded webhook).
// 20260904 adds Phase 20 #23 (overbooking prevention: btree_gist + EXCLUDE
// constraint on (room_unit_id, daterange) + atomic create_booking RPC).
// 20260905 fixes the FOR UPDATE on aggregate function bug in 20260904's
// create_booking RPC — uses PERFORM 1 ... FOR UPDATE then a separate COUNT.
// 20260906 adds Phase 20 #24 (cancellation policy enforcement: atomic
// cancel_booking RPC that enforces free_cancel_hours + refund_pct, creates
// refund_requests row if paid + refund > 0, inserts booking_events audit).
// 20260907 fixes the auth.uid() = null rejection for service_role callers
// in 20260906's cancel_booking RPC (admin scripts + walk-in tooling have
// no JWT — must be allowed past the auth gate).
// 20260908 adds Phase 20 #25 (email infrastructure: email_log table with
// event_key UNIQUE idempotency + RLS for staff SELECT).
// 20260909 adds Phase 19 #17 (payments_amount_positive CHECK — defense
// against zero-amount refund/payment rows; existing rows already pass).
// 20260910 fixes Phase 19 #18 — confirm_refund_session RPC now preserves
// payment_status='partial_refund' instead of unconditionally clobbering to
// 'refunded' on charge.refunded webhook arrival (action-layer override race).
// 20260913 enforces NOT NULL on profiles.phone and bookings.booker_phone
// (backfilled to '0000000000'); updates handle_new_user() to insert sentinel
// for OAuth users missing phone in metadata.
// 20260914 updates handle_new_user() to copy birthdate from
// raw_user_meta_data (NULL when missing — OAuth path stays nullable).
// 20260915 (×2) — preview_cancel_booking RPC + profiles.phone UNIQUE
// (defense against duplicate-sentinel backfill regression from 20260913).
// 20260916 caps promotions.max_discount at 100% (defense against typo).
// 20260917 adds promotions.applies_to_room_types room_type_enum[] for
// optional per-type promo scoping.
// 20260918 adds Phase 28 housekeeping assignment flow: on_booking_checked_out
// trigger (auto-create unassigned cleaning task) + floor_assignments table
// for persisted per-floor housekeeper defaults. Closes the gap where docs
// claimed check-out creates a cleaning task but no trigger ever shipped.
// 20260919 adds Phase 29 refund approval hardening: tightens bookings self
// update RLS (deny payment_status='refunded'|'partial_refund' from
// authenticated role), new refund_requests owner-read policy so users can
// see their own refund status badge, BEFORE UPDATE trigger that auto-stamps
// decided_at + decided_by if RPC is bypassed, CHECK constraint requiring
// decision_note on rejection.
// 20260920 adds Phase 30 housekeeping allocation: room_types.estimated_cleaning_minutes
// (Deluxe=20/Suite=30/Villa=45 per user spec), housekeeping_tasks.estimated_minutes snapshot,
// widens room_units.status CHECK with waiting_cleaning/inspection/ready/checkout,
// on_task_status_change rewritten for inspection + ready semantics, on_booking_checked_out
// also flips room → waiting_cleaning + snapshots minutes, v_next_checkin_per_room view,
// allocate_housekeeping_tasks(jsonb, boolean) SECURITY DEFINER RPC for race-safe commit of
// TS-computed assignments.
// 20260921 fixes 20260920 RPC + trigger to allow service_role callers (mirrors Phase 20 #24
// pattern: auth.role()='service_role' bypass). The task INSERT inside on_booking_checked_out
// still requires auth.uid() (created_by NOT NULL), but the room-status flip always runs.
// NOTE: alternation MUST include every migration number — missing numbers are silently skipped.
// 20260826 = manager RLS fix-up (housekeeping_tasks INSERT widened to include 'manager')
// 20260828 = Phase 7 admin foundation + recursion fix
// Earlier phases (20260820-20260825) were applied by their respective phase runners.
// 20260924 = Phase 32 room_types soft-delete (deleted_at column + tightened public RLS).
// 20260925 = Phase 32 hotfix — drop stale "public read room_types" policy from migration 20260819.
// 20260926 = Phase X room_types i18n — short_desc_th / description_th / view_label_th nullable columns.
// 20260927 = Phase 34.5 hotfix — fix RLS recursion in "profiles admin write" (inline EXISTS → has_role()).
// 20260928 = Phase 36 customer suspension — is_suspended/suspended_at/suspended_reason columns + booking_events.booking_id nullable.
const allFiles = readdirSync(migrationsDir)
  .filter((f) => /202608(26|27|28|29|30|31|32|33|34)|202609(02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28)_.*\.sql$/.test(f))
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
