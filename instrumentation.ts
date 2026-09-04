import * as Sentry from '@sentry/nextjs'

/**
 * Next.js 16 instrumentation hook (Phase 20 #28).
 *
 * Called once at server startup. Conditionally loads the Sentry server
 * config (only when SENTRY_DSN is set — no-op otherwise).
 *
 * `onRequestError` captures request-scoped errors with their full
 * request context (URL, method, headers, cookies) into Sentry.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
}

export const onRequestError = Sentry.captureRequestError
