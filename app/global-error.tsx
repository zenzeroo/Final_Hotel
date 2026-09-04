'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Root error boundary (Phase 20 #28).
 *
 * Catches errors that escape every other error boundary in the app —
 * e.g. errors in the root layout itself. Captures the exception into
 * Sentry and shows a minimal branded fallback.
 *
 * This MUST be a Client Component and MUST render <html> + <body>
 * (per Next.js docs: global-error replaces the root document).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset?: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="th">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          backgroundColor: '#faf7f2',
          color: '#1a1a1a',
        }}
      >
        <div style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>เกิดข้อผิดพลาด</h1>
          <p style={{ marginBottom: 24, color: '#666' }}>
            ระบบพบปัญหาที่ไม่คาดคิด เราได้บันทึกรายละเอียดไว้แล้ว
            กรุณาลองใหม่อีกครั้ง หรือกลับหน้าหลัก
          </p>
          {reset ? (
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 24px',
                borderRadius: 999,
                backgroundColor: '#1a1a1a',
                color: '#faf7f2',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ลองใหม่
            </button>
          ) : null}
        </div>
      </body>
    </html>
  )
}
