/**
 * Migrate images from Google URLs (V1_Prototype) to Cloudflare R2.
 *
 * Usage:
 *   1. Ensure .env.local has R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
 *   2. Run: node scripts/migrate-images.mjs
 *
 * Output:
 *   - Uploads all images to R2 bucket
 *   - Writes scripts/image-map.json (URL → key)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile, writeFile } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Load .env.local
loadEnv({ path: resolve(ROOT, '.env.local') })

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'zenzero-hotel'

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing R2 credentials in .env.local')
  console.error('   Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
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

const CONFIG_FILE = resolve(__dirname, 'migration-config.json')
const OUTPUT_FILE = resolve(__dirname, 'image-map.json')

const URL_RE = /https:\/\/lh3\.googleusercontent\.com\/aida-public\/[A-Za-z0-9_=-]+/g

async function extractUrls(filePath) {
  const html = await readFile(filePath, 'utf-8')
  return [...new Set(html.match(URL_RE) || [])]
}

async function download(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'zenzero-migration/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}...`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/webp'
  return { buffer, contentType }
}

async function upload(key, buffer, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
}

async function main() {
  console.log('🚀 Starting R2 migration…')
  console.log(`   Bucket: ${R2_BUCKET_NAME}\n`)

  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'))
  const imageMap = {} // { googleUrl: r2Key }
  let successCount = 0
  let errorCount = 0

  for (const pageCfg of Object.values(config.pages)) {
    console.log(`📄 ${pageCfg.label}`)

    const urls = await extractUrls(pageCfg.file)
    console.log(`   Found ${urls.length} unique URLs`)

    for (const mapping of pageCfg.mappings) {
      const url = urls[mapping.urlIndex]
      if (!url) {
        console.error(`   ⚠️  No URL at index ${mapping.urlIndex} for ${mapping.name}`)
        errorCount++
        continue
      }

      try {
        const { buffer, contentType } = await download(url)
        await upload(mapping.key, buffer, contentType)
        imageMap[url] = mapping.key
        successCount++
        console.log(`   ✅ ${mapping.name} → ${mapping.key} (${(buffer.length / 1024).toFixed(1)} KB)`)
      } catch (err) {
        errorCount++
        console.error(`   ❌ ${mapping.name}: ${err.message}`)
      }
    }
    console.log()
  }

  // Write image-map.json
  await writeFile(OUTPUT_FILE, JSON.stringify(imageMap, null, 2), 'utf-8')
  console.log(`📝 Wrote ${OUTPUT_FILE}`)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed:  ${errorCount}`)
  if (errorCount === 0) {
    console.log('🎉 All images uploaded to R2!')
  } else {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
