import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { hasR2 } from '../env'
import { r2Client, R2_BUCKET } from './client'
import { wrapSupabaseError } from '../errors/supabase'

/**
 * Delete a single object from the Cloudflare R2 bucket.
 *
 * Used by admin image-removal flows (currently `updateRoomTypeAction` in
 * `app/actions/admin/rates.ts` after the form-submit refactor). Mirrors
 * the structure of `lib/r2/upload.ts:uploadImageToR2`:
 *   - Throws if R2 is not configured (caller should surface to user).
 *   - Throws if `key` is empty.
 *   - Wraps R2 SDK errors via `wrapSupabaseError` so server logs show context.
 *
 * Best-effort semantics: callers should treat R2 delete failures as
 * non-fatal (the DB state is the source of truth — orphan R2 files
 * can be cleaned up by a periodic script). The action returns success
 * even if this throws.
 */
export async function deleteObjectFromR2(key: string): Promise<void> {
  if (!hasR2 || !r2Client) {
    throw new Error(
      'Cloudflare R2 ยังไม่ได้ตั้งค่า — เพิ่ม R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ใน .env.local',
    )
  }
  if (!key || typeof key !== 'string') {
    throw new Error('deleteObjectFromR2: empty or invalid key')
  }

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }),
    )
  } catch (e) {
    wrapSupabaseError(`R2 delete ${key}`, e)
  }
}