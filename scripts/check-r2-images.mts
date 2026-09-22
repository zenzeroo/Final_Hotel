#!/usr/bin/env node
/**
 * Check R2 image state vs DB expectations.
 *
 * Compares:
 *   - room_types.hero_image_key (active, non-deleted, non-empty)
 *   - hotel_settings.hero_image_key (nullable)
 *   - Hardcoded references in components/landing/HeroSection.tsx, login, register
 *
 * For each key, runs HeadObjectCommand against R2 and reports status.
 *
 * Usage:
 *   npx tsx scripts/check-r2-images.mts
 *   npm run images:check
 *
 * Exit code:
 *   0 — all expected keys exist in R2
 *   1 — at least 1 key missing
 */
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFile } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Load .env.local
loadEnv({ path: resolve(ROOT, '.env.local') })

// Import after env load
const { pgPoolerConfig } = await import('./_db-connection.mjs')

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'zenzero-hotel'

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing R2 credentials in .env.local')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

async function queryRoomHeroKeys(client) {
  const res = await client.query(`
    SELECT slug, name, hero_image_key
    FROM room_types
    WHERE is_active = true
      AND deleted_at IS NULL
      AND hero_image_key IS NOT NULL
      AND hero_image_key != ''
    ORDER BY slug
  `)
  return res.rows.map(r => ({ slug: r.slug, key: r.hero_image_key, source: 'room_types' }))
}

async function queryHotelHeroKey(client) {
  const res = await client.query(`
    SELECT hero_image_key FROM hotel_settings WHERE id = 1 AND hero_image_key IS NOT NULL
  `)
  return res.rows.filter(r => r.hero_image_key).map(r => ({ key: r.hero_image_key, source: 'hotel_settings' }))
}

async function headCheck(key) {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    return { status: 'exists', httpCode: res.$metadata?.httpStatusCode ?? 200 }
  } catch (e) {
    const httpCode = e.$metadata?.httpStatusCode
    if (httpCode === 404) return { status: 'missing', httpCode: 404 }
    return { status: 'error', httpCode: httpCode ?? 'unknown', error: e.name ?? String(e) }
  }
}

async function main() {
  console.log(`🔍 Checking R2 bucket "${R2_BUCKET_NAME}"…\n`)

  const client = new Client(pgPoolerConfig())
  await client.connect()

  let allKeys = []
  try {
    const roomKeys = await queryRoomHeroKeys(client)
    const hotelKeys = await queryHotelHeroKey(client)
    // Add hardcoded home hero references from code
    const hardcoded = [{ key: 'hero/home-hero.webp', source: 'code:hardcoded' }]
    allKeys = [...roomKeys, ...hotelKeys, ...hardcoded]
  } finally {
    await client.end()
  }

  const rows = []
  for (const entry of allKeys) {
    const { status, httpCode, error } = await headCheck(entry.key)
    rows.push({ ...entry, status, httpCode, error })
  }

  // Summary
  const exists = rows.filter(r => r.status === 'exists').length
  const missing = rows.filter(r => r.status === 'missing').length
  const errors = rows.filter(r => r.status === 'error').length

  console.log('=== R2 Image Status ===\n')
  console.table(rows.map(r => ({
    key: r.key,
    source: r.source,
    status: r.status === 'exists' ? '✅ exists' : r.status === 'missing' ? '❌ missing' : `⚠️ ${r.error ?? httpCode}`,
  })))

  console.log(`\nSummary: ${exists} exists, ${missing} missing, ${errors} error(s)`)

  if (missing > 0) {
    console.log('\n❌ Some expected images are missing from R2. Run `npm run images:upload` to fix.')
    process.exit(1)
  }
  if (errors > 0) {
    console.log('\n⚠️ Some images returned errors. Check R2 credentials / network.')
    process.exit(2)
  }
  console.log('\n🎉 All expected images exist in R2!')
}

main().catch(err => {
  console.error('💥 Fatal:', err)
  process.exit(3)
})
