import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { r2Client, R2_BUCKET } from './client'
import { deleteObjectFromR2 } from './delete'
import { validateLegalPdf } from '@/lib/legal/pdf-validate'
import { LEGAL_DOCS, LEGAL_DOC_COLUMN } from '@/lib/legal/docs'

/**
 * Phase 62 — upload an admin legal document (PDF) to R2 under a fresh
 * `legal/<uuid>.pdf` key. Keys are never reused: objects are cached as
 * immutable, and published versions point at them forever.
 */
export class LegalPdfError extends Error {
  constructor(public readonly reason: 'empty' | 'type' | 'size' | 'magic' | 'storage') {
    super(`LegalPdfError: ${reason}`)
    this.name = 'LegalPdfError'
  }
}

export async function uploadPdfToR2(file: File): Promise<string> {
  if (!r2Client) throw new LegalPdfError('storage')
  const body = Buffer.from(await file.arrayBuffer())
  const check = validateLegalPdf({ type: file.type, size: file.size, head: body.subarray(0, 5) })
  if (!check.ok) throw new LegalPdfError(check.reason)

  const key = `legal/${randomUUID()}.pdf`
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  } catch {
    throw new LegalPdfError('storage')
  }
  return key
}

/**
 * Delete a replaced draft object — unless a published version points at it
 * (a publish may have copied the key just before the swap). Returns whether
 * the object was deleted. A failed delete only leaves an orphan object.
 */
export async function deleteLegalObjectIfUnpublished(
  client: SupabaseClient,
  key: string | null,
): Promise<boolean> {
  if (!key) return false
  const filter = LEGAL_DOCS.map((d) => `${LEGAL_DOC_COLUMN[d]}.eq."${key}"`).join(',')
  const { count, error } = await client
    .from('legal_versions')
    .select('id', { count: 'exact', head: true })
    .or(filter)
  if (error || (count ?? 0) > 0) return false
  try {
    await deleteObjectFromR2(key)
    return true
  } catch {
    return false
  }
}
