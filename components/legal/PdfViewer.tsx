'use client'

/**
 * Phase 62 — renders an admin-uploaded legal PDF exactly as authored
 * (fonts are embedded in the PDF). pdf.js draws every page at the width of
 * the container, so phones get the same layout, scaled down. Text stays
 * selectable (text layer) and links clickable (annotation layer).
 * Import through PdfViewerLazy — pdf.js touches browser-only APIs on load.
 */
import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfViewerProps {
  /** Same-origin URL, e.g. /legal-files/privacy-th?v=<id> */
  src: string
  downloadName: string
}

export function PdfViewer({ src, downloadName }: PdfViewerProps) {
  const t = useT()
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>(0)
  const [pages, setPages] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const openLink = (
    <a
      href={src}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 text-primary font-semibold underline-offset-2 hover:underline"
    >
      <MaterialIcon name="open_in_new" size={16} />
      {t('legal.openPdf')}
    </a>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <a
          href={src}
          download={`${downloadName}.pdf`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-label-md text-primary hover:bg-primary-fixed transition-colors"
        >
          <MaterialIcon name="download" size={16} />
          {t('legal.download')}
        </a>
      </div>
      <div ref={boxRef} className="w-full">
        {failed ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center text-body-md text-on-surface-variant">
            <p>{t('legal.viewerFailed')}</p>
            {openLink}
          </div>
        ) : (
          <Document
            file={src}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={() => setFailed(true)}
            loading={<div className="h-[60vh] w-full animate-pulse rounded-xl bg-surface-container" />}
            error={null}
            className="flex flex-col gap-4"
          >
            {width > 0 &&
              Array.from({ length: pages }, (_, i) => (
                <Page
                  key={i}
                  pageNumber={i + 1}
                  width={width}
                  className="overflow-hidden rounded-lg shadow-(--shadow-ambient)"
                />
              ))}
          </Document>
        )}
      </div>
    </div>
  )
}
