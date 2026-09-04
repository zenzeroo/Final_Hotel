import * as Sentry from '@sentry/nextjs'

/**
 * Sentry browser-side init (Phase 20 #28).
 *
 * Optional — does nothing if NEXT_PUBLIC_SENTRY_DSN is empty.
 * Lets the project build + run without a Sentry account configured
 * (DSN unset = Sentry silently no-ops via `enabled: false`).
 *
 * Set NEXT_PUBLIC_SENTRY_DSN + SENTRY_DSN in `.env.local` to enable.
 * Get a DSN at https://sentry.io → Project → Settings → Client Keys (DSN).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% — production sample; raise to 1.0 in dev
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0, // capture replay on errors only (cheap)
    debug: false,
    environment: process.env.NODE_ENV,
  })
}
