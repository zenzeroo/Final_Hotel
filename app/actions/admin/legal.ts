'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require'
import { actionFail } from '@/lib/errors/supabase'
import { getServerT } from '@/lib/i18n/server'
import { isLegalDoc } from '@/lib/legal/docs'
import { setLegalDraftKey, publishLegalVersion, dropReplacedLegalObject } from '@/lib/data/legal'
import { uploadPdfToR2, LegalPdfError } from '@/lib/r2/upload-pdf'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// =====================================================
// Phase 62 — admin legal documents (PDF drafts + publish)
// =====================================================

const PDF_ERROR_KEY = {
  empty: 'admin.legalPage.errEmpty',
  type: 'admin.legalPage.errType',
  size: 'admin.legalPage.errSize',
  magic: 'admin.legalPage.errMagic',
  storage: 'admin.legalPage.errStorage',
} as const

/**
 * Replaced draft objects can go — except when a publish copied the key into
 * a version just before the swap; dropReplacedLegalObject checks that.
 */
async function dropObject(key: string | null) {
  await dropReplacedLegalObject(key).catch(() => {})
}

/** Upload one PDF into a draft slot. FormData: `doc` (LegalDoc), `file`. */
export async function uploadLegalDraftAction(formData: FormData): Promise<ActionResult> {
  await requireRole('admin', '/admin/legal')
  const { t } = await getServerT()
  const doc = String(formData.get('doc') ?? '')
  const file = formData.get('file')
  if (!isLegalDoc(doc) || !(file instanceof File)) return { ok: false, error: t('admin.legalPage.errType') }

  let key: string
  try {
    key = await uploadPdfToR2(file)
  } catch (e) {
    if (e instanceof LegalPdfError) return { ok: false, error: t(PDF_ERROR_KEY[e.reason]) }
    return actionFail(e, t('admin.legalPage.errStorage'))
  }
  try {
    await dropObject(await setLegalDraftKey(doc, key))
  } catch (e) {
    await dropObject(key)
    return actionFail(e, t('admin.legalPage.errStorage'))
  }
  revalidatePath('/admin/legal')
  return { ok: true }
}

export async function removeLegalDraftAction(doc: string): Promise<ActionResult> {
  await requireRole('admin', '/admin/legal')
  const { t } = await getServerT()
  if (!isLegalDoc(doc)) return { ok: false, error: t('admin.legalPage.errStorage') }
  try {
    await dropObject(await setLegalDraftKey(doc, null))
  } catch (e) {
    return actionFail(e, t('admin.legalPage.errStorage'))
  }
  revalidatePath('/admin/legal')
  return { ok: true }
}

/** Draft → new version. Every customer must accept it before continuing. */
export async function publishLegalVersionAction(): Promise<ActionResult<{ version: string }>> {
  await requireRole('admin', '/admin/legal')
  const { t } = await getServerT()
  let version: string
  try {
    version = (await publishLegalVersion()).version
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'NOTHING_TO_PUBLISH') return { ok: false, error: t('admin.legalPage.errNothing') }
    if (msg === 'INCOMPLETE') return { ok: false, error: t('admin.legalPage.errIncomplete') }
    return actionFail(e, t('admin.legalPage.errStorage'))
  }
  revalidatePath('/privacy')
  revalidatePath('/terms')
  revalidatePath('/admin/legal')
  return { ok: true, data: { version } }
}
