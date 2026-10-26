'use client'

import dynamic from 'next/dynamic'

/**
 * Phase 62 — client-only PdfViewer (pdf.js cannot load during SSR). Pages
 * and modals import this; the pdf.js bundle loads only where it is used.
 */
export const PdfViewerLazy = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse rounded-xl bg-surface-container" />,
})
