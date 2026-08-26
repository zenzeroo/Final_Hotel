/**
 * Run a SQL file against Supabase via the pooler.
 * Usage: node scripts/run-sql.mjs <sql-file>
 */
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pgPoolerConfig } from './_db-connection.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-sql.mjs <sql-file>')
  process.exit(1)
}

const projectRef = pgPoolerConfig().user.replace(/^postgres\./, '')
const client = new pg.Client(pgPoolerConfig())

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
