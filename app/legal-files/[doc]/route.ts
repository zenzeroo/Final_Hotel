import type { NextRequest } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from '@/lib/r2/client'
import { getSession } from '@/lib/supabase/getSession'
import { getLegalDraft, getLegalVersionById } from '@/lib/data/legal'
import { isLegalDoc } from '@/lib/legal/docs'

/**
 * Phase 62 — serves the admin-uploaded legal PDFs from our own origin, so
 * pdf.js (PdfViewer) can fetch them without CORS rules on the R2 bucket.
 *
 *   GET /legal-files/<doc>?v=<legal_versions.id>  published, public, immutable
 *   GET /legal-files/<doc>?v=draft                 draft slot, admin only, no-store
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: RouteContext<'/legal-files/[doc]'>) {
  const { doc } = await ctx.params
  const v = request.nextUrl.searchParams.get('v') ?? ''
  if (!isLegalDoc(doc) || !r2Client) return new Response('Not found', { status: 404 })

  let key: string | null
  let cacheControl: string
  if (v === 'draft') {
    const session = await getSession()
    if (session?.role !== 'admin') return new Response('Forbidden', { status: 403 })
    key = (await getLegalDraft())[doc]
    cacheControl = 'no-store'
  } else {
    key = (await getLegalVersionById(v))?.keys[doc] ?? null
    // The URL names an immutable version row, so the bytes never change.
    cacheControl = 'public, max-age=31536000, immutable'
  }
  if (!key) return new Response('Not found', { status: 404 })

  try {
    const obj = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    if (!obj.Body) return new Response('Not found', { status: 404 })
    return new Response(obj.Body.transformToWebStream(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc}.pdf"`,
        'Cache-Control': cacheControl,
      },
    })
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return new Response('Not found', { status: 404 })
    throw e
  }
}
