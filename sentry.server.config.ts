import * as Sentry from '@sentry/nextjs'

/**
 * Sentry server-side init (Phase 20 #28).
 *
 * Optional — does nothing if SENTRY_DSN is empty.
 * Captures errors thrown in Server Components, Server Actions, and API
 * route handlers. Stripe webhook + payment flow errors go here.
 */
const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.NODE_ENV,
  })
}
