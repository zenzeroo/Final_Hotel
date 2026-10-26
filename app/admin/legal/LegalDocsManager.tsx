'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  uploadLegalDraftAction,
  removeLegalDraftAction,
  publishLegalVersionAction,
} from '@/app/actions/admin/legal'
import { LegalDocModal } from '@/components/legal/LegalDocModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'
import { formatBangkokDate, formatBangkokTime } from '@/lib/dates'
import { LEGAL_DOCS, legalFileUrl, type LegalDoc, type LegalKeys } from '@/lib/legal/docs'
import { canPublish } from '@/lib/legal/publish-rule'
import { LEGAL_PDF_MAX_BYTES } from '@/lib/legal/pdf-validate'
import type { LegalVersionRow } from '@/lib/legal/current'

const DOC_LABEL_KEY: Record<LegalDoc, string> = {
  'privacy-th': 'admin.legalPage.docPrivacyTh',
  'privacy-en': 'admin.legalPage.docPrivacyEn',
  'terms-th': 'admin.legalPage.docTermsTh',
  'terms-en': 'admin.legalPage.docTermsEn',
}

export function LegalDocsManager({
  draft,
  current,
  versions,
}: {
  draft: LegalKeys
  current: LegalVersionRow | null
  versions: Array<LegalVersionRow & { publisherName: string }>
}) {
  const t = useT()
  const toast = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyDoc, setBusyDoc] = useState<LegalDoc | null>(null)
  const [preview, setPreview] = useState<{ doc: LegalDoc; src: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileInputs = useRef<Partial<Record<LegalDoc, HTMLInputElement | null>>>({})

  const publishCheck = canPublish(draft, current?.keys ?? null)

  /**
   * Runs an action; a rejected call (network error, request body over the
   * server-action limit) becomes an error toast instead of an unhandled
   * rejection, and the busy state always clears.
   */
  function run(action: () => Promise<{ ok: boolean; error?: string }>, okKey: string, doc: LegalDoc | null = null) {
    setBusyDoc(doc)
    startTransition(async () => {
      try {
        const r = await action()
        if (r.ok) {
          toast.success(t(okKey))
          router.refresh()
        } else toast.error(r.error ?? t('admin.legalPage.errStorage'))
      } catch {
        toast.error(t('admin.legalPage.errStorage'))
      } finally {
        setBusyDoc(null)
      }
    })
  }

  function upload(doc: LegalDoc, file: File) {
    // Same limit the server enforces; checked here so an oversized file
    // never hits the server-action body limit.
    if (file.size > LEGAL_PDF_MAX_BYTES) {
      toast.error(t('admin.legalPage.errSize'))
      return
    }
    const fd = new FormData()
    fd.set('doc', doc)
    fd.set('file', file)
    run(() => uploadLegalDraftAction(fd), 'admin.legalPage.uploadOk', doc)
  }

  function removeDraft(doc: LegalDoc) {
    run(() => removeLegalDraftAction(doc), 'admin.legalPage.removeOk', doc)
  }

  function publish() {
    setConfirmOpen(false)
    run(() => publishLegalVersionAction(), 'admin.legalPage.publishOk')
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="flex items-start gap-2 rounded-xl bg-secondary-container/40 px-4 py-3 text-body-md text-on-surface">
        <MaterialIcon name="info" size={20} className="text-primary shrink-0 mt-0.5" />
        {t('admin.legalPage.hint')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LEGAL_DOCS.map((doc) => {
          const hasDraft = !!draft[doc]
          const hasPublished = !!current?.keys[doc]
          const previewSrc = hasDraft
            ? legalFileUrl(doc, 'draft')
            : hasPublished && current
              ? legalFileUrl(doc, current.id)
              : null
          const busy = busyDoc === doc
          return (
            <section
              key={doc}
              className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-(--shadow-ambient)"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg text-primary">{t(DOC_LABEL_KEY[doc])}</h2>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold ${
                    hasDraft
                      ? 'bg-warning/15 text-warning'
                      : hasPublished
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {hasDraft
                    ? t('admin.legalPage.statusDraft')
                    : hasPublished
                      ? t('admin.legalPage.statusPublished')
                      : t('admin.legalPage.statusEmpty')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={(el) => {
                    fileInputs.current[doc] = el
                  }}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) upload(doc, f)
                  }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileInputs.current[doc]?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
                >
                  <MaterialIcon name="upload_file" size={18} />
                  {busy ? t('admin.legalPage.uploading') : t('admin.legalPage.upload')}
                </button>
                {previewSrc && (
                  <button
                    type="button"
                    onClick={() => setPreview({ doc, src: previewSrc })}
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-label-md text-primary hover:bg-primary-fixed transition-colors"
                  >
                    <MaterialIcon name="visibility" size={18} />
                    {t('admin.legalPage.preview')}
                  </button>
                )}
                {hasDraft && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeDraft(doc)}
                    className="inline-flex items-center gap-2 rounded-lg border border-error px-4 py-2 text-label-md text-error hover:bg-error hover:text-on-primary transition-colors disabled:opacity-60"
                  >
                    <MaterialIcon name="delete" size={18} />
                    {t('admin.legalPage.removeDraft')}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          disabled={pending || !publishCheck.ok}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md font-semibold uppercase tracking-wider text-on-primary hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50"
        >
          <MaterialIcon name="publish" size={18} />
          {t('admin.legalPage.publish')}
        </button>
        {!publishCheck.ok && (
          <p className="text-caption text-on-surface-variant">
            {publishCheck.reason === 'INCOMPLETE'
              ? t('admin.legalPage.publishNeedsAll')
              : t('admin.legalPage.publishNothing')}
          </p>
        )}
      </div>

      <section>
        <h2 className="font-display text-xl text-primary mb-3">{t('admin.legalPage.history')}</h2>
        {versions.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">{t('admin.legalPage.historyEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-lowest">
            <table className="w-full text-body-md">
              <thead className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">{t('admin.legalPage.colVersion')}</th>
                  <th className="px-4 py-3">{t('admin.legalPage.colDate')}</th>
                  <th className="px-4 py-3">{t('admin.legalPage.colBy')}</th>
                  <th className="px-4 py-3">{t('admin.legalPage.colFiles')}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3 font-mono text-caption">{v.version}</td>
                    <td className="px-4 py-3">
                      {formatBangkokDate(v.publishedAt)} {formatBangkokTime(v.publishedAt)}
                    </td>
                    <td className="px-4 py-3">{v.publisherName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {LEGAL_DOCS.map((doc) => (
                          <a
                            key={doc}
                            href={legalFileUrl(doc, v.id)}
                            target="_blank"
                            rel="noopener"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {doc}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && (
        <LegalDocModal
          open
          onClose={() => setPreview(null)}
          title={t(DOC_LABEL_KEY[preview.doc])}
          src={preview.src}
          downloadName={preview.doc}
        />
      )}
      <ConfirmModal
        open={confirmOpen}
        variant="danger"
        body={t('admin.legalPage.publishWarn')}
        okLabel={t('admin.legalPage.publish')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={publish}
      />
    </div>
  )
}
