import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import { hasR2, env } from '../env'
import { r2Client, R2_BUCKET } from './client'

/**
 * Server-side image upload to Cloudflare R2.
 *
 * Mirrors `scripts/migrate-images.mjs:67-77` — same `CacheControl` so assets are
 * immutable for one year. Used by the admin RoomTypeForm to push hero + gallery
 * images without leaving the server-action flow.
 */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'R2UploadError'
  }
}

/** Normalize a file extension to `.jpg | .png | .webp` (lowercase, with dot). */
export function pickExt(file: File): string {
  // Prefer mime-type (browser-reported, more reliable)
  if (file.type === 'image/jpeg') return '.jpg'
  if (file.type === 'image/png') return '.png'
  if (file.type === 'image/webp') return '.webp'
  // Fallback to filename
  const match = file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)
  if (match) {
    if (match[1] === 'jpeg' || match[1] === 'jpg') return '.jpg'
    if (match[1] === 'png') return '.png'
    if (match[1] === 'webp') return '.webp'
  }
  return '.jpg' // default
}

/**
 * Build the canonical R2 object key for a room image.
 * Hero files overwrite the previous hero (deterministic key).
 * Gallery files get a UUID suffix so multiple uploads coexist.
 */
export function roomImageKey(slug: string, kind: 'hero' | 'gallery', ext: string): string {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (kind === 'hero') return `rooms/${safeSlug}/hero${ext}`
  return `rooms/${safeSlug}/gallery-${randomUUID().slice(0, 8)}${ext}`
}

interface UploadResult {
  key: string
}

/**
 * Upload a single File to R2 under `key`. Returns the stored key on success.
 * Throws `R2UploadError` with an actionable Thai message on any failure
 * (so the admin form can surface it directly).
 */
export async function uploadImageToR2(file: File, key: string): Promise<UploadResult> {
  if (!hasR2) {
    throw new R2UploadError(
      'Cloudflare R2 ยังไม่ได้ตั้งค่า — เพิ่ม R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ใน .env.local',
    )
  }
  if (!r2Client) {
    throw new R2UploadError('ไม่สามารถเชื่อมต่อ R2 client ได้')
  }
  if (!file || file.size === 0) {
    throw new R2UploadError('ไฟล์รูปภาพว่างเปล่า')
  }
  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    throw new R2UploadError(`ไฟล์ใหญ่เกินไป (${mb} MB) — จำกัดที่ 10 MB`)
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new R2UploadError(`ชนิดไฟล์ไม่รองรับ (${file.type || 'unknown'}) — รองรับเฉพาะ JPEG / PNG / WebP`)
  }

  const body = Buffer.from(await file.arrayBuffer())

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new R2UploadError(`อัปโหลดไป R2 ล้มเหลว: ${detail}`)
  }

  return { key }
}
