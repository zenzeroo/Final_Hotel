/**
 * Run a SQL file against Supabase via direct Postgres connection.
 * Usage: node scripts/run-sql.mjs <sql-file>
 */
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config as loadEnv } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

loadEnv({ path: resolve(ROOT, '.env.local') })

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-sql.mjs <sql-file>')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectRef) {
  console.error('❌ Could not extract project ref from URL')
  process.exit(1)
}

// URL-encode the password to handle special characters
const encodedPassword = encodeURIComponent(DB_PASSWORD)
// Use Supabase Pooler (port 6543) — direct connection (5432) is often blocked
// Format: postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

const client = new pg.Client({ connectionString })

async function main() {
  const sql = await readFile(resolve(ROOT, sqlFile), 'utf-8')
  console.log(`📄 Running ${sqlFile} (${sql.length} bytes) → ${projectRef}`)

  await client.connect()
  try {
    await client.query(sql)
    console.log('✅ Success')
  } catch (err) {
    console.error('❌ SQL error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
