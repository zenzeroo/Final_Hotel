import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/payments/stripe'
import { closeExpiredCheckoutSessions } from '@/lib/payments/close-expired-sessions'

/**
 * Phase 56 — called every minute by the pg_cron job
 * `close-expired-stripe-sessions` (via pg_net) when a booking that has an
 * open Stripe page has just expired or been cancelled.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` — the same value is stored
 * in Supabase Vault as `cron_secret`. Refuses everything when the env var
 * is not set.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!stripe) {
    return NextResponse.json({ ok: true, skipped: 'no payment gateway' })
  }

  try {
    const admin = await createAdminClient()
    const result = await closeExpiredCheckoutSessions(stripe, admin)
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() })
  } catch (e) {
    console.error('[cron/close-expired-sessions]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
