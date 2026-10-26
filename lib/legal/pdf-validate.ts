/**
 * Phase 62 — check an admin-uploaded legal document before it reaches R2.
 * Only real PDFs: the browser-reported type is not enough (a renamed .docx
 * keeps `application/pdf`), so the first bytes must be the `%PDF-` header.
 */
// 4 MB: the file travels in a server-action body (next.config.ts
// serverActions.bodySizeLimit = 5mb; Vercel caps request bodies at ~4.5 MB).
export const LEGAL_PDF_MAX_BYTES = 4 * 1024 * 1024

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

export function validateLegalPdf(f: {
  type: string
  size: number
  head: Uint8Array
}): { ok: true } | { ok: false; reason: 'empty' | 'type' | 'size' | 'magic' } {
  if (f.size === 0) return { ok: false, reason: 'empty' }
  if (f.type !== 'application/pdf') return { ok: false, reason: 'type' }
  if (f.size > LEGAL_PDF_MAX_BYTES) return { ok: false, reason: 'size' }
  if (!PDF_MAGIC.every((b, i) => f.head[i] === b)) return { ok: false, reason: 'magic' }
  return { ok: true }
}
