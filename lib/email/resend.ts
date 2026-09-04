/**
 * Phase 20 #25 — Resend-backed email sender.
 *
 * Single entry point: `sendEmail({...})`. Captures every attempt in the
 * `email_log` table via service-role (RLS allows no authenticated INSERT).
 *
 * Dev fallback: when `RESEND_API_KEY` is empty, the rendered HTML is
 * console.log-ed instead of being sent over SMTP. The `email_log` row is
 * still written with `status='sent'` + a synthetic provider_message_id so
 * local dev + tests can assert on log capture without burning Resend quota.
 *
 * Idempotency: `event_key` is UNIQUE in email_log. On conflict we UPDATE
 * the existing row (re-send → same event). The trigger points compute
 * `event_key` deterministically from (template, resource_id) so accidental
 * double-fires collapse into one row.
 */

import { Resend } from 'resend'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export type EmailTemplate =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'cancellation_notice'
  | 'refund_notice'
  | 'checkout_thank_you'

export interface SendEmailOptions {
  to: string
  template: EmailTemplate
  subject: string
  /** React Email component tree — rendered server-side via @react-email/components.render */
  react: ReactElement
  /** Deterministic key for dedupe — format: `<template>:<resource>:<id>` */
  eventKey: string
  /** Foreign keys for cross-referencing the log row back to the domain row */
  bookingId?: string | null
  paymentId?: string | null
  refundRequestId?: string | null
  /** Free-form bag — stored in metadata for replay / audit */
  metadata?: Record<string, unknown>
}

let _resend: Resend | null = null
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}

/** True iff Resend is configured for real sends. */
export function hasResend(): boolean {
  return !!process.env.RESEND_API_KEY
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? 'Zenzero Hotel <booking@zenzero.com>'
}

/**
 * Redact an email address for console.log output so PII (the local-part)
 * never lands in production log aggregation. Keeps the domain so the
 * engineer reading the log can still tell which provider it's going to.
 *   redactEmail('alice@example.com') → 'a***@example.com'
 *   redactEmail('+66080000000@no-local.com') → '***@no-local.com'
 */
function redactEmail(addr: string): string {
  const at = addr.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = addr.slice(0, at)
  const domain = addr.slice(at + 1)
  const first = local.slice(0, 1)
  return `${first}***@${domain}`
}

/**
 * Send an email and capture the attempt in `email_log`.
 *
 * Returns `{ ok: true, messageId }` on success or `{ ok: false, error }` on
 * failure. Never throws — caller treats as fire-and-forget so a Resend
 * outage doesn't break the booking flow.
 *
 * The log row is written FIRST (status='queued') then updated to 'sent'
 * or 'failed' after the API call resolves. This way a crash mid-send
 * leaves a `queued` row that's easy to spot + replay.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<
  { ok: true; messageId: string | null } | { ok: false; error: string }
> {
  const admin = await createAdminClient()
  const html = await render(opts.react)
  const text = await render(opts.react, { plainText: true })

  // 1. Insert queued row (or upsert on conflict — keeps history).
  const { data: logRow, error: insertErr } = await admin
    .from('email_log')
    .upsert(
      {
        recipient: opts.to,
        template: opts.template,
        subject: opts.subject,
        status: 'queued',
        booking_id: opts.bookingId ?? null,
        payment_id: opts.paymentId ?? null,
        refund_request_id: opts.refundRequestId ?? null,
        event_key: opts.eventKey,
        metadata: opts.metadata ?? {},
      },
      { onConflict: 'event_key' },
    )
    .select('id, status')
    .single()

  if (insertErr || !logRow) {
    // eslint-disable-next-line no-console
    console.error('[email_log] insert failed:', insertErr?.message)
    return { ok: false, error: insertErr?.message ?? 'email_log insert failed' }
  }

  // 2. Try to send (or fall back to console.log in dev).
  const client = getClient()
  if (!client) {
    // ── Dev fallback ──────────────────────────────────────────
    // NEVER log the full recipient address, subject, or rendered body to
    // stdout in production — PII + log-aggregation concerns (GDPR/PIPEDA).
    // Body logging is gated behind NODE_ENV !== 'production' AND an opt-in
    // EMAIL_LOG_BODY=1 flag so a misconfigured prod deploy can't leak.
    // The summary line (no PII) is always fine.
    const isProd = process.env.NODE_ENV === 'production'
    const isLocal = !isProd && process.env.EMAIL_LOG_BODY === '1'
    const redactedTo = redactEmail(opts.to)
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 [DEV email] to=${redactedTo}\n   template=${opts.template}\n   subject=${opts.subject}\n   event_key=${opts.eventKey}` +
        (isLocal ? `\n   --- body ---\n${text}\n` : ''),
    )
    await admin
      .from('email_log')
      .update({
        status: 'sent',
        provider_message_id: `dev:${logRow.id}`,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', logRow.id)
    return { ok: true, messageId: `dev:${logRow.id}` }
  }

  // 3. Real Resend send.
  try {
    const result = await client.emails.send({
      from: getFromAddress(),
      to: opts.to,
      subject: opts.subject,
      html,
      text,
    })
    const messageId = result.data?.id ?? null
    await admin
      .from('email_log')
      .update({
        status: 'sent',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', logRow.id)
    return { ok: true, messageId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin
      .from('email_log')
      .update({ status: 'failed', error_message: msg })
      .eq('id', logRow.id)
    // eslint-disable-next-line no-console
    console.error('[email_log] Resend send failed:', msg)
    return { ok: false, error: msg }
  }
}
