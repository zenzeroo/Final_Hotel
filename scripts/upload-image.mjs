/**
 * Upload local image files to Cloudflare R2.
 *
 * Use this instead of migrate-images.mjs when V1 Google URLs are dead
 * (see scripts/preflight-google-urls.mts).
 *
 * Usage:
 *   node scripts/upload-image.mjs --key=hero/home-hero.webp --file=C:\path\to\image.jpg
 *   node scripts/upload-image.mjs --manifest=./upload-manifest.json
 *
 * Manifest format:
 *   [{ "key": "hero/home-hero.webp", "file": "C:\\path\\to\\image.jpg", "note": "optional" }]
 *
 * Output:
 *   - Uploads all files to R2 bucket
 *   - Writes scripts/image-map.json (file path → key)
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

loadEnv({ path: resolve(ROOT, '.env.local') })

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'zenzero-hotel'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

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

// Key whitelist — prevents typos from overwriting arbitrary R2 objects
const KEY_ALLOW = [
  /^hero\/[a-z0-9_-]+\.(webp|jpg|png)$/,
  /^rooms\/[a-z0-9-]+\/hero\.(webp|jpg|png)$/,
  /^rooms\/[a-z0-9-]+\/gallery\/[a-z0-9_-]+\.(webp|jpg|png)$/,
  /^reviews\/avatars\/[a-z0-9_-]+\.(webp|jpg|png)$/,
]

function validateKey(key) {
  if (!KEY_ALLOW.some(re => re.test(key))) {
    throw new Error(`Key "${key}" not in whitelist (hero/*, rooms/<slug>/hero.*, etc.)`)
  }
}

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

function contentTypeFor(file) {
  const ext = file.toLowerCase().match(/\.[a-z]+$/)?.[0]
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

async function upload(key, filePath) {
  validateKey(key)
  const buffer = await readFile(filePath)
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentTypeFor(filePath),
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )
  // Confirm upload
  await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
  return buffer.length
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (const arg of args) {
    const m = arg.match(/^--([^=]+)=(.+)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

async function loadManifest(path) {
  const raw = await readFile(resolve(ROOT, path), 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Manifest must be a JSON array')
  return data
}

async function main() {
  const args = parseArgs()
  const manifestPath = args.manifest
  const singleKey = args.key
  const singleFile = args.file

  let entries = []
  if (manifestPath) {
    entries = await loadManifest(manifestPath)
  } else if (singleKey && singleFile) {
    entries = [{ key: singleKey, file: singleFile }]
  } else {
    console.error('❌ Usage:')
    console.error('   node scripts/upload-image.mjs --manifest=./upload-manifest.json')
    console.error('   node scripts/upload-image.mjs --key=hero/home-hero.webp --file=C:\\path\\image.jpg')
    process.exit(1)
  }

  console.log(`🚀 Uploading ${entries.length} file(s) to R2…`)
  console.log(`   Bucket: ${R2_BUCKET_NAME}`)
  if (R2_PUBLIC_URL) console.log(`   Public: ${R2_PUBLIC_URL}\n`)
  else console.log()

  const imageMap = {} // { absoluteFilePath: { key, publicUrl } }
  let success = 0
  let failed = 0

  for (const entry of entries) {
    const { key, file } = entry
    try {
      const stats = await stat(file)
      if (!stats.isFile()) throw new Error('Not a file')
      const bytes = await upload(key, file)
      const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}` : null
      imageMap[file] = { key, publicUrl, bytes, uploadedAt: new Date().toISOString() }
      success++
      console.log(`   ✅ ${key}  (${(bytes / 1024).toFixed(1)} KB)  ←  ${file}`)
    } catch (err) {
      failed++
      console.error(`   ❌ ${key}: ${err.message}`)
    }
  }

  const outputFile = resolve(__dirname, 'image-map.json')
  // Merge with existing map if present
  let existing = {}
  try {
    existing = JSON.parse(await readFile(outputFile, 'utf8'))
  } catch {}
  const merged = { ...existing, ...imageMap }
  await writeFile(outputFile, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`\n📝 Updated ${outputFile}`)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`✅ Success: ${success}`)
  console.log(`❌ Failed:  ${failed}`)
  if (failed > 0) process.exit(1)
  console.log('🎉 All uploads complete!')
}

main().catch(err => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
