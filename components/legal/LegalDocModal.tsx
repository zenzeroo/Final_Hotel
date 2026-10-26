'use client'

import { Modal } from '@/components/ui/Modal'
import { PdfViewerLazy } from './PdfViewerLazy'

/** Phase 62 — a legal PDF in a large scrollable modal (register, /consent, admin preview). */
export function LegalDocModal({
  open,
  onClose,
  title,
  src,
  downloadName,
}: {
  open: boolean
  onClose: () => void
  title: string
  src: string
  downloadName: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      showCloseButton
      maxWidthClass="max-w-4xl"
      body={
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          {open && <PdfViewerLazy src={src} downloadName={downloadName} />}
        </div>
      }
    />
  )
}
