<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Zenzero Hotel — Claude Code Working Notes

> Read this file at the start of every session in this project.
> Repo root: `Y:\Final\final` (working tree) + `Y:\Final\db-schemas\` (local DB archive)

---

## 📋 Project Rules (Claude Code — apply every session)

Rules ละเอียดเต็มอยู่ใน `Rule.md` ที่ root — สรุปสั้นๆ ที่นี่:

### R1 — Document Solved Problems

เมื่อเจอ bug / error / unexpected behavior แล้วแก้ได้สำเร็จ ต้องเพิ่ม bullet ลง `## Common Pitfalls` (ด้านล่าง) ทันที — format:
```
- **<short name>** — <symptom/error> → <fix + reason>
```
อย่าบันทึก error ที่แก้ง่าย (typo, missing import) หรือ one-off issue ที่ไม่กระทบ pattern

### R2 — Ask Before Git Commit / Push

ทุกครั้งที่จะ `git commit` หรือ `git push` ต้องถาม user ให้อนุมัติก่อนเสมอ — ห้ามทำเองโดยไม่ได้รับ explicit approval

- ก่อน commit: รวบรวมไฟล์ + แสดง diff stat + commit message → ถาม "OK to commit?"
- ก่อน push: ระบุ branch ปลายทาง → ถาม "OK to push to <remote>/<branch>?"
- Exception: user ระบุ "commit แล้ว push" พร้อม message/branch ในคำสั่งเดียว → ทำได้ทันที

---

## 📊 Project Status

| Phase | สถานะ | หมายเหตุ |
|---|---|---|
| 1 — Room types + amenities + profiles | ✓ | Initial schema + auth trigger |
| 2 — Bookings + reviews + policies + promos | ✓ | Self-RLS + status enum |
| 3 — Staff role + room_units + events + notes | ✓ | Recursion fix in `20260820_fix_rls_recursion.sql` |
| 4 — Housekeeping + maintenance | ✓ | Tasks table + 3 enums + trigger sync |
| 5 — Manager role + reviews RLS | ✓ | Widened is_staff() + dropped over-broad policies |
| 6 — Manager portal (4 pages) | ✓ | Dashboard, bookings, HK, refunds |
| 7 — Admin portal (15 pages) | ✓ | CRUD promotions, staff, settings, seasonal rates |
| 8 — Pricing engine | ✓ | `quoteStay()` + `pickSeasonalRate()` + seasonal-aware pricing |
| 9 — Backend wiring + tests | ✓ | 24 stub functions → real PostgREST; 43/43 smoke tests passed |
| 10 — Refund RPC + KPI accuracy | ✓ | `approve_refund(uuid)` SECURITY DEFINER + real 7d revenue trend |
| 11 — RBAC hardening | ✓ | `roleHomePath()` helper + `(booking)` User-only layout + 4 staff layout redirects + 10 `requireXxx` helpers + signIn always applies role branch |
| 12 — Backend wiring v2 + secrets rotation | ✓ | `listCancellationPolicies` + `getReportsData()` analytics arrays wired; `scripts/_db-connection.mjs` pooler + direct SSL helpers; migration `20260834` (bookings.channel + room_unit_id); password leak ใน `check-cols.mjs` ใช้ `pgDirectConnectionString()` แทน |
| 14 — Google OAuth login | ✓ | Supabase hosted OAuth (`signInWithOAuth({ provider: 'google' })`) + `signInWithGoogle` server action + `app/auth/callback/route.ts`; LoginForm/RegisterForm `useTransition` + `setGoogleError` สำหรับ surface error; Thai translation ของ `provider is not enabled` |
| 15 — DB documentation | ✓ | `Y:\Final\db-schemas\schema-documentation.docx` (Thai Word — 17 tables + 11 enums + 4 SECURITY DEFINER fns) + `drawio-prompt.txt` (Mermaid ER + draw.io CSV + NL prompt) |
| 16 — Refactor + clean-up pass | ✓ | Quick wins + Type safety — 9 commits on `origin/main` (2026-08-28). New helpers: `lib/auth/require.ts` (consolidates 11 requireXxx), `lib/errors/supabase.ts` (wrapSupabaseError + actionFail, replaces 70 throw sites), `lib/ids.ts` (UUID_RE + isUuid), `lib/auth/sanitize.ts` (relocated from app/auth). Deleted: dead code (imageUrl/R2_BUCKET), void casts, `.ca-bundle.crt`, duplicate `getRoomById` + duplicate `isUuid` defs. Full plan + deferred items: `C:\Users\suns9\.claude\plans\nifty-chasing-raccoon.md` |
| 17 — Stripe payment gateway | ✓ | `payments` table + 3 SECURITY DEFINER RPCs (`create_payment_session` / `confirm_payment_session` / `expire_payment_session`) + `/api/payments/webhook` (HMAC-verified) + `createCheckoutSessionAction`/`markCashPaidAction`; user + walk-in; cards + PromptPay in THB; webhook-driven status updates via `provider_event_id` UNIQUE idempotency. `markPaid` stub deleted (was a security hole — owner could self-mark paid). 5 commits on `origin/main` (2026-09-02). Plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md` |
| 18 — Stripe refund wiring | ✓ | `confirm_refund_session(text,text)` RPC + `charge.refunded` webhook handler branch + `buildRefundIdempotencyKey` helper + `approveRefundAction` rewrite (Stripe-first D5 ordering + partial_refund override + audit row) + `scripts/test-phase18-stripe-refund.mts` (7 integration tests). Closes gap where Stripe payments flipped `payment_status='refunded'` in DB but never actually refunded the customer's card. 4 commits on `origin/main` (2026-09-02). Plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md`. |
| 19 — Overbooking prevention (Phase 20 Block 1) | ✓ | `create_booking(uuid,uuid,date,date,...)` SECURITY DEFINER RPC (`db-schemas/20260904_create_booking_rpc_and_constraint.sql` + `20260905_fix_create_booking_lock.sql`) with `PERFORM 1 ... FOR UPDATE` row lock on room_units pool + overlapping booking rows + overlap count under `daterange && daterange`; defense-in-depth EXCLUDE constraint `bookings_no_unit_overlap` on `(room_unit_id WITH =, daterange(check_in, check_out, '[)') WITH &&) WHERE room_unit_id IS NOT NULL AND status IN ('confirmed','checked_in')`. `app/actions/booking.ts:138-178` + `app/actions/walk-in-booking.ts:157-239` refactored to call RPC; P0001 → Thai error message. `scripts/test-phase20-overbooking.mts` (7 integration tests pass: single insert, non-overlapping, overlapping rejected, cancel+rebook, 5-way concurrent, walk-in-vs-web overlap, EXCLUDE constraint). Closes gap where two web bookings for same `room_type_id` + overlapping dates both succeeded at DB level. Plan: `C:\Users\suns9\.claude\plans\project-quirky-storm.md`. |
| 20 — Cancellation policy enforcement (Phase 20 Block 2) | ✓ | `cancel_booking(uuid, boolean, numeric)` SECURITY DEFINER RPC (`db-schemas/20260906_cancel_booking_rpc.sql` + `20260907_fix_cancel_booking_auth.sql`) locks booking `FOR UPDATE`, validates `status='confirmed'` state guard, looks up linked cancellation_policy (or `is_default=true` fallback), computes refund via `free_cancel_hours` + `refund_pct` + override, flips `bookings.status='cancelled'`, inserts `refund_requests` row when `payment_status='paid' AND refund_amount > 0`, inserts `booking_events` audit row with full policy metadata. Returns typed TABLE: booking_id, booking_status, refund_amount, penalty_amount, policy_name, policy_free_hours, refund_request_id, hours_until_checkin. `app/actions/booking.ts` — `cancelBooking` (guest path) + new `cancelBookingByStaff(bookingId, refundPctOverride)` (reception/manager/admin, override requires manager/admin via `has_role`); also auto-inserts `booking_events` audit. UI in `ConfirmationActions.tsx` + `BookingHistory.tsx` + `BookingRowActions.tsx` surfaces policy name + refund/penalty breakdown. `scripts/test-phase24-cancel-policy.mts` — 7 integration tests pass (Flexible full refund, NULL-policy → default, checked-in blocked, double-cancel blocked, unpaid → no refund row, staff override 100%, audit metadata). Closes contractual gap where cancel always gave 100% refund regardless of policy. Plan: `C:\Users\suns9\.claude\plans\project-quirky-storm.md`. |
| 25 — Email infrastructure (Phase 20 Block 3) | ✓ | Resend + React Email integration. `email_log` table (`supabase/migrations/20260908_email_log.sql`) — `event_key` UNIQUE for dedup, FK to bookings/payments/refund_requests with `ON DELETE SET NULL`, RLS staff SELECT + manager UPDATE. `lib/email/resend.ts` — `sendEmail({to, template, subject, react, eventKey, ...})` writes a `queued` row first, sends via Resend, updates to `sent`/`failed`; dev fallback `console.log` when `RESEND_API_KEY` empty + logs row still marked `sent` with `dev:` prefix. 5 React Email templates in `lib/email/templates/`: booking_confirmation, payment_receipt, cancellation_notice, refund_notice, checkout_thank_you (all Thai). Hooks wired into: `app/actions/booking.ts:182-222` (booking_confirmation) + `388-437` (cancellation_notice via `fireCancellationNotice` helper); `app/actions/walk-in-booking.ts:241-277` (booking_confirmation); `app/api/payments/webhook/route.ts:137-179` (`firePaymentReceipt` for card/PromptPay); `app/actions/payment.ts:212-258` (cash payment_receipt); `app/actions/manager.ts:160-195` (refund_notice inside try block, scoped to `rr`); new `app/actions/check-in-out.ts` (`checkOutBookingAction` fires checkout_thank_you); refactored `app/reception/check-in-out/CheckInOutActions.tsx` from client-side supabase update → server action call. `scripts/test-phase25-email.mts` — 7 integration tests pass (event_key UNIQUE, dev-fallback lifecycle, idempotent re-fire, 5 templates × 3 statuses, FK cross-reference join, anon RLS blocks SELECT, ON DELETE SET NULL cascades). Closes gap where zero transactional email existed (no booking confirmation, no payment receipt, no refund notice, no thank-you). Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`. |

**Current HEAD**: TBD on `main` (Phase 20 #25 shipped — email infrastructure; Phase 20 Block 3 complete. Block 4 next — Phase 19 #17 `payments.amount` backfill + CHECK quick win.)

---

## 🧰 Tech Stack (versions verified from `package.json`)

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `next` | `16.3.0` | App Router + Turbopack, **no** `middleware.ts` — uses `proxy.ts` |
| Runtime | `react`, `react-dom` | `19.2.8` | Async `params`/`searchParams`, `useActionState` |
| Language | `typescript` | `^5` | **strict: true** (tsconfig.json:7) |
| Styling | `tailwindcss` + `@tailwindcss/postcss` | `^4.3.3` | **CSS-only config** in `app/globals.css @theme {}` — ไม่มี `tailwind.config.ts` |
| DB | `@supabase/ssr` | `^0.5.2` | Cookie-based auth for RSC + Server Actions |
| DB | `@supabase/supabase-js` | `2.112.3` | Service-role client for admin + scripts |
| R2 | `@aws-sdk/client-s3` | `3.1112.0` | S3-compatible Cloudflare R2 client |
| Validation | `zod` | `3.25.76` | Input validation in server actions |
| Date math | `date-fns` | `3.6.0` | Used in `lib/pricing.ts:calculateNights` |
| Charts | `chart.js` + `react-chartjs-2` | `^4.5.1` / `^5.3.1` | Server-rendered charts (manager dashboard) |
| Dev | `eslint` | `^9` | Flat config + Next.js presets |
| Dev | `pg` | `^8.23.0` | Direct Postgres for migration runner |
| Dev | `dotenv` | `^16.6.1` | `.env.local` loading for scripts |

**Node version requirement**: ไม่ pin ใน `package.json` — แนะนำ Node ≥ 20.x (Next.js 16 minimum) [ต้องยืนยัน]

---

## 🎨 Coding Conventions (observed in code)

### File naming
- **Pages**: `app/<route>/page.tsx` — lowercase, kebab-case for nested dirs
- **Layouts**: `app/<route>/layout.tsx` — same as page
- **Server actions**: `app/actions/<topic>.ts` หรือ `app/actions/admin/<topic>.ts` — every file starts with `'use server'`
- **Data wrappers**: `lib/data/<domain>.ts` — toggle layer, exports from `mock-<domain>.ts` OR `supabase-<domain>.ts`
- **Components**: `components/<domain>/<Name>.tsx` — PascalCase, organized by domain (ui/, room/, manager/, admin/, housekeeping/, search/, layout/, feedback/, landing/, review/)

### TypeScript
- **strict**: true (`tsconfig.json:7`)
- **Path alias**: `@/*` → `./*` (tsconfig.json:21-23)
- **`scripts/` excluded from project tsconfig** (`tsconfig.json:33`) — relies on `npx tsx` for type-stripping
- **All shared types** in `lib/data/types.ts` (443 lines) — RoomType, Booking, Promotion, StaffMember, HotelSettings, SeasonalRate, etc.

### Tailwind v4 pattern
- **`tailwind.config.ts`**: does NOT exist (confirmed)
- All design tokens (`@theme {}`) ใน `app/globals.css` — brand colors, spacing, shadows, font sizes
- ใช้ tokens เช่น `bg-primary`, `text-secondary`, `shadow-(--shadow-ambient-lg)` (CSS var via arbitrary value)

### State management
- **ไม่มี external state library** (no zustand/jotai/redux/recoil/valtio/mobx/xstate) — confirmed via `package.json`
- ใช้ React built-ins เท่านั้น: `useState`, `useTransition`, `useEffect`, `useMemo`
- **Forms**: `useActionState` + `useFormStatus` (e.g. `PromotionForm.tsx:78`, `HotelSettingsForm.tsx:74`)
- **Client navigation**: `useRouter` from `next/navigation`
- **Server data**: Server Components + `revalidatePath()` after mutations

### Server Action pattern (every action)
```ts
'use server'
type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

export async function someAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole('manager', '/manager')
  
  // 1. Parse + Zod-validate inputs
  // 2. Call data layer wrapper (e.g. approveRefund({ refundId }))
  // 3. revalidatePath('/manager')
  // 4. Return { ok: true } or actionFail(e, 'Could not …')
}
```

Note: `requireRole(allowed, redirectPath?)` lives in `lib/auth/require.ts` —
replaces the 11 inline `requireXxx` helpers that used to live in each action file.
`actionFail(e, fallback)` lives in `lib/errors/supabase.ts` and surfaces
`e.message` to the user instead of relying on browser `console.error`.

### Mock vs real data toggle
3 patterns in use:
1. **Pattern A** (`manager.ts`, `reviews.ts`, `housekeeper.ts`) — `useMock` evaluated at top of file, every export is `useMock ? mock.X : real.X`
2. **Pattern B** (`rooms.ts`) — uses `isUsingMockData` from `lib/env.ts`, per-call ternary
3. **Pattern C** (`bookings.ts`, `staff.ts`) — **no toggle**, always hits Supabase via `createClient()`

### Component patterns
- **Server Components** for data fetching + tables + forms with no interactivity
- **Client Components** (`'use client'`) for forms, dropdowns, modals, action buttons (e.g. `ApproveRefundButton`, `TaskClaimButton`)
- 34/ 82 components are client components
- **Force-dynamic** directive ทุก page ที่ fetch user data (per R1 pitfalls)

---

## 🗄️ Database Schema (summary)

**Pointers**:
- `Y:\Final\db-schemas\` — 24 migrations + 2 seeds (canonical SQL, byte-identical to `supabase/migrations/`)
- `Y:\Final\db-schemas\schema-documentation.docx` — Thai Word doc (17 tables + 11 enums + 4 SECURITY DEFINER fns + triggers + RLS summary)
- `Y:\Final\db-schemas\drawio-prompt.txt` — 3 formats for ER diagram (Mermaid ER / draw.io CSV / natural-language prompt)

### Tables (17)
- `profiles` — auto-populated from auth.users via `handle_new_user()` trigger
- `room_types`, `amenities` — public catalog
- `room_units` — physical rooms, status enum (available/occupied/cleaning/maintenance/out_of_order)
- `bookings` — `check_out > check_in` CHECK constraint; `booking_status` + `payment_status` enums
- `reviews` — `status` (pending/approved/hidden); avg/count recalc by trigger
- `cancellation_policies` — public read
- `promotions` — public read active; admin/manager write
- `housekeeping_tasks` — type/status/priority enums; triggers sync `room_units.status`
- `maintenance_reports` — issue_type/severity/status; auto-flags critical → maintenance
- `booking_events` — audit log (created/confirmed/checked_in/checked_out/cancelled/note_added/refund_approved)
- `guest_notes` — request/complaint/compliment/general
- `damage_reports` — staff read/insert; manager+admin resolve
- `refund_requests` — staff read; manager+admin decide (no INSERT policy — created by booking cancel flow)
- `hotel_settings` — singleton row (id=1); admin write
- `seasonal_rates` — date-range overrides (flat_price OR price_multiplier, min_nights_override, priority)
- `staff_shifts` — staff_id+shift_date PK; morning/afternoon/evening/off

### Enums (11)
| Enum | Values | Where |
|---|---|---|
| `room_type_enum` | Deluxe, Suite, Villa | `20260818_init.sql:11` |
| `bed_type_enum` | King, Queen, Twin | `20260818_init.sql:15` |
| `booking_status` | pending, confirmed, checked_in, checked_out, cancelled | `20260819_bookings.sql:8` |
| `payment_status` | unpaid, paid, refunded, partial_refund | `20260819_bookings.sql:12` |
| `user_role` | user, reception, housekeeper, admin, manager | `20260820_staff_role.sql:8` + ALTER `20260825:8` |
| `housekeeping_task_type` | cleaning, turn_down, deep_clean, inspection, restock | `20260821:2` |
| `housekeeping_task_status` | unassigned, assigned, in_progress, completed, cancelled | `20260821:3` |
| `housekeeping_task_priority` | low, normal, high, urgent | `20260821:4` |
| `maintenance_issue_type` | plumbing, electrical, hvac, furniture, appliance, other | `20260822:1` |
| `maintenance_severity` | low, medium, high, critical | `20260822:2` |
| `maintenance_status` | open, in_progress, resolved | `20260822:3` |

### SECURITY DEFINER functions (4 — RLS bypass + atomic logic)
| Function | Signature | Purpose |
|---|---|---|
| `handle_new_user()` | `() RETURNS trigger` | Auto-insert profile on auth signup (mirrors email/hired_at; rewritten `20260832`) |
| `is_staff()` | `() RETURNS boolean` | True iff role ∈ (reception, housekeeper, manager, admin) |
| `has_role(text)` | `(text) RETURNS boolean` | True iff role = check_role |
| `approve_refund(uuid)` | `(uuid) RETURNS refund_requests` | **Phase 10** — atomic manager approval + booking payment_status flip + double-decision guard |

### Non-SECURITY-DEFINER utility triggers
- `touch_updated_at()` — generic BEFORE UPDATE updated_at setter
- `recalc_room_rating()` — recomputes room_types.avg/count from approved reviews only
- `reviews_guard_staff_update()` — BEFORE UPDATE blocks staff from modifying protected review fields
- `on_task_status_change()` — syncs room_units.status with task lifecycle
- `on_maintenance_insert()` — auto-flags room_units.status='maintenance' on critical severity

---

## 🔑 Business Logic — must-know rules

### Booking rules
- **Date check**: `check_out > check_in` enforced by CHECK constraint (`20260819_bookings.sql:47`)
- **Pricing** (`lib/pricing.ts`):
  - `calculateNights(checkIn, checkOut)` — date-fns `differenceInCalendarDays` (≥0)
  - `calculatePrice()`: `baseSubtotal = nights × basePrice`; `feeTotal = nights × 150`; `taxTotal = round((baseSubtotal - discount) × 0.07)`; `total = baseSubtotal - discount + tax + fee`
  - Tax rate 0.07 + resort fee 150 hardcoded in `pricing.ts:42-43` (NOT read from `env.NEXT_PUBLIC_TAX_RATE`/`NEXT_PUBLIC_RESORT_FEE` despite env vars existing) [ต้องยืนยัน]
- **Seasonal-aware pricing** (`lib/pricing/seasons.ts`):
  - `pickSeasonalRate(rates, date)` — highest-priority active rate whose date range contains `date`
  - `quoteStay()` — per-night breakdown with applied rates + baseSubtotal
  - `violatesMinNights()` — throws if any applied rate has `min_nights_override > quote.nights`
- **Booking code** format: `ZZR-` + 5 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`pricing.ts:128`)

### Booking lifecycle (booking_status)
1. **pending** — created (online via `createBooking` server action with quote + atomic insert)
2. **confirmed** — payment marked paid (staff `markPaid`)
3. **checked_in** — staff check-in (`reception/check-in-out`)
4. **checked_out** — staff check-out
5. **cancelled** — user self-cancel or staff override
- **`no_show` was added to enum live in DB** (not in `20260819_bookings.sql`) [ต้องยืนยัน — was a Phase 9 live-DB bug fix]

### Payment lifecycle (payment_status)
- `unpaid` → `paid` (via `markPaid` server action)
- `paid` → `refunded` (via `approve_refund(uuid)` RPC — atomic with refund_requests.status)
- `partial_refund` exists but no code path writes it yet [ต้องยืนยัน]

### Room status lifecycle (room_units.status enum)
- `available` → `occupied` (check-in)
- `occupied` → `cleaning` (check-out + housekeeping task created)
- `cleaning` → `available` (housekeeping complete task)
- Any → `maintenance` (manual close, or auto on critical maintenance report)
- `maintenance` → `available` (resolve maintenance + reopen)

### Housekeeping trigger (`on_task_status_change()`)
- สร้าง `housekeeping_tasks` row → `room_units.status='cleaning'` (auto)
- `in_progress` → still cleaning
- `completed` → `room_units.status='available'`
- `cancelled` → reverts to previous status [ต้องยืนยัน — depends on trigger logic]

### Refund flow (Phase 10)
1. Guest cancels booking → booking cancel flow creates `refund_requests` row (status='pending') [ต้องยืนยัน — no INSERT policy, created via service role or another RPC]
2. Manager reviews at `/manager/bookings?tab=refunds` — clicks "Approve"
3. `approveRefundAction` → calls `approve_refund(uuid)` RPC (SECURITY DEFINER)
4. RPC atomically: locks refund row (FOR UPDATE), guards double-decision, flips:
   - `refund_requests.status='approved'` + `decided_at=now()` + `decided_by=auth.uid()`
   - `bookings.payment_status='refunded'` (linked booking)
5. `revalidatePath('/manager')` + `revalidatePath('/manager/bookings')`

### Review flow
- Guest submits via `createReviewAction` after check-out → status='pending'
- Manager/reception/admin moderates via `moderateReviewAction` → status='approved' or 'hidden'
- `recalc_room_rating()` trigger recomputes `room_types.rating_avg/count` from approved only
- Staff CANNOT modify `user_id/room_type_id/booking_id/created_at/rating/title/body` — `reviews_guard_staff_update()` trigger blocks

---

## ⚡ Common Commands

### Dev + quality
```bash
npm run dev                # Dev server (Turbopack, port 3000)
npm run build              # Production build
npm run start              # Run production build
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit (excludes scripts/)
```

### Database
```bash
node scripts/run-migrations.mjs                       # Apply pending migrations
node scripts/run-migrations.mjs --only=20260833       # Apply single migration
node scripts/run-migrations.mjs --dry-run             # Preview
node scripts/run-sql.mjs supabase/migrations/<file>.sql   # One-off SQL via Pooler
npm run db:migrate        # alias for run-migrations.mjs (no flags)
```

### Tests (run individually — no `npm test`)
```bash
npx tsx scripts/test-phase10-kpi-trend.mts       # Phase 10 KPI accuracy (live DB)
npx tsx scripts/test-phase10-refund-rpc.mts      # Phase 10 refund RPC (live DB)
npx tsx scripts/_cleanup-test-rows.mts           # Cleanup leaked test bookings
# All other test-phase*-*.mts are Phase 6–9 (mostly USE_MOCK_DATA=1)
```

### R2 — git
```bash
# Always ask user first per R2
git status
git diff --stat
git add <files>          # explicit paths, never -A
git commit -m "..."       # show message + diff stat first
git push origin main     # specify branch
```

---

## ⚠️ Rules / Warnings

### ห้าม commit
- `.env*` (any variant — `.env.example` ก็ ignore แล้วใน `.gitignore`)
- `supabase/migrations/` + `supabase/*.sql` (gitignored — archive ที่ `Y:\Final\db-schemas\`)
- `.dev-server*.log`, `scripts/.ca-bundle.crt`, `scripts/.supabase-ca.crt`, `supabase/.temp/`
- `docs/`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `Rule.md` (gitignored — local-only per project convention)

### ห้ามแก้ schema โดยตรง
- ทุกการเปลี่ยน schema ต้องผ่าน migration ใหม่ใน `supabase/migrations/` (format `YYYYMMDD_NN_topic.sql`)
- หลัง apply แล้ว copy ไป `Y:\Final\db-schemas\` (local archive)
- เพิ่มเลข migration ใน regex ที่ `scripts/run-migrations.mjs:54` (มิงั้น apply ไม่ติด)

### RLS policy rules
- **ห้ามใช้ inline `EXISTS (select 1 from public.profiles ...)` ใน policy** — Postgres 42P17 recursion error
- ใช้ `is_staff()` หรือ `has_role(text)` SECURITY DEFINER helper แทน
- **ทุก UPDATE policy ต้องมีทั้ง `USING` และ `WITH CHECK` clauses**
- ใช้ `(select auth.uid())` (subquery) แทน `auth.uid()` ใน policies — ช่วยให้ RLS cache ได้

### Mock/real toggle
- `USE_MOCK_DATA` evaluate **at module load** — เปลี่ยน env แล้วต้อง restart `npm run dev`
- ถ้า `USE_MOCK_DATA=1` + Supabase ไม่ config → `bookings.ts` + `staff.ts` (Supabase-only) จะ throw

### Commit hygiene
- Per R2: ต้องถามก่อน `git commit` / `git push` เสมอ
- Local working tree ตอนนี้อยู่บน branch `main` (rename จาก `master` แล้ว — see commit history)

---

## 🪤 Common Pitfalls (Next.js 16 + Zenzero-specific)

### Next.js 16 conventions
- `params` and `searchParams` are **Promises** — always `await props.params` / `await props.searchParams`
- Use `PageProps<'/route'>` and `LayoutProps<'/route'>` (global types from `next typegen`)
- For pages that fetch user data: add `export const dynamic = 'force-dynamic'`
- `cookies()` is async — always `await cookies()`
- **Do NOT use `middleware.ts`** — use `proxy.ts` at root
- Do NOT create `tailwind.config.ts` — Tailwind v4 is CSS-only
- `'use client'` directive required for any component using hooks/browser APIs

### Zenzero-specific (learned the hard way)

- **RLS infinite recursion (42P17)** — inline `EXISTS` on `profiles` ใน policy → ใช้ `is_staff()` / `has_role(text)` SECURITY DEFINER helpers แทน. เคยเกิดใน `20260820_staff_rls.sql` แก้ใน `20260820_fix_rls_recursion.sql`

- **Overbooking at booking insert (Phase 19 fix)** — ก่อน Phase 19, `createBooking` แค่ validate `is_active + max_guests` (`app/actions/booking.ts:138-165`) — ไม่เช็ค physical inventory สำหรับช่วงวันที่เลือก. Two web bookings for same `room_type_id` + overlapping dates both succeed at DB level; conflict surfaces ตอน reception check-in เท่านั้น. Fix: `create_booking(...)` SECURITY DEFINER RPC (`db-schemas/20260904_create_booking_rpc_and_constraint.sql`) locks the room_units pool under `PERFORM 1 ... FOR UPDATE` (NOT `SELECT count(*) ... FOR UPDATE` — see below), counts slot-occupying bookings (`status IN ('confirmed','checked_in')`) overlapping the date range via `daterange && daterange`, throws P0001 when `count >= pool_size`. Defense-in-depth EXCLUDE constraint `bookings_no_unit_overlap` fires at check-in when `room_unit_id` is assigned. RPC grants EXECUTE to `authenticated` + `service_role` — auth check is the server action's responsibility. Walking-in flow (`walk-in-booking.ts`) now inserts booking via admin.rpc() then flips `payment_status='paid'` + records `payments` row in a follow-up step (RPC always writes 'unpaid'). Reference: `scripts/test-phase20-overbooking.mts` (7 tests pass covering single insert, non-overlapping, overlapping rejection, cancel+rebook, 5-way concurrent, walk-in-vs-web, EXCLUDE constraint)

- **`FOR UPDATE` is not allowed with aggregate functions (Phase 19 #23 pitfall)** — Postgres rejects `SELECT count(*) FROM t WHERE ... FOR UPDATE` with SQLSTATE 0A000 ("FOR UPDATE is not allowed with aggregate functions"). To lock rows + count in the same transaction: do `PERFORM 1 FROM t WHERE ... FOR UPDATE` first (acquires the row locks), then a separate non-locking `SELECT count(*) FROM t WHERE ...` in the same plpgsql function body — safe because the row locks serialise concurrent critical sections for the matching rows. Shipped buggy in `20260904_create_booking_rpc_and_constraint.sql`; fixed in `20260905_fix_create_booking_lock.sql` (drops + recreates the function). Caught by the 7-case integration test on first run — all 7 cases failed with SQLSTATE 0A000 until the fix migration applied. When writing any future RPC that needs atomic count-under-lock, use the PERFORM-then-COUNT pattern (or `pg_advisory_xact_lock(key)` for named locks). Reference: `app/actions/booking.ts:138-178` + `walk-in-booking.ts:157-239` are now backed by this pattern

- **Cancellation policy bypassed (Phase 20 #24 fix)** — ก่อน Phase 24, `cancelBooking` (`app/actions/booking.ts:183-201`) แค่ `UPDATE bookings SET status='cancelled'` โดยไม่เช็ค `cancellation_policy` เลย — guest กดยกเลิกตอนไหนก็ได้ 100% refund ทั้งหมด แม้กระทั่ง 5 นาทีก่อนเช็คอินบน Strict policy (168h free window / 0% refund) = contract violation. Fix: `cancel_booking(uuid, boolean, numeric)` SECURITY DEFINER RPC (`db-schemas/20260906_cancel_booking_rpc.sql`) — locks booking `FOR UPDATE`, validates `status='confirmed'`, looks up policy (or default fallback), computes `refund_amount = total * refund_pct/100` based on hours-until-checkin vs `free_cancel_hours` (or staff override), flips status, inserts `refund_requests` row only when `payment_status='paid' AND refund_amount > 0` (manager reviews + approves via existing Phase 10/18 path), inserts `booking_events` audit with full policy metadata. RPC returns typed TABLE so UI can show "จะได้รับเงินคืน X / เสียค่าธรรมเนียม Y ตามนโยบาย <name>". Two follow-up pitfalls caught + fixed in `20260907_fix_cancel_booking_auth.sql`: (1) `auth.uid() IS NULL` blocked service_role callers (admin scripts, walk-in tooling, the integration test itself) — fix uses `coalesce(auth.role(),'') <> 'service_role'` to bypass auth gate; (2) `actor_role` insert cast needed explicit `::user_role` because the column is enum not text. Reference: `app/actions/booking.ts` (cancelBooking + cancelBookingByStaff) + `scripts/test-phase24-cancel-policy.mts` (7 tests pass)

- **email_log.booking_id uses ON DELETE SET NULL, not CASCADE (Phase 20 #25)** — `20260908_email_log.sql` declared FKs as `references public.bookings(id) on delete set null` (same for `payments.id` + `refund_requests.id`) — the email audit row survives a booking deletion with its FK column set to NULL, NOT row deletion. Rationale: even if a booking is hard-deleted (test cleanup, accidental admin delete), the email history ("we sent X template to Y address on Z date") is preserved for compliance / replay / debugging. When writing FK cleanup tests: assert `afterRows.length === 1` (row exists) + `afterRows[0].booking_id === null` (FK cleared), NOT that the row was cascade-deleted. Phase 25 caught this in `scripts/test-phase25-email.mts` Case 7 — first version of the test expected the row to vanish with the booking, got `null` count after `head:true` query, fixed to verify ON DELETE SET NULL semantics

- **Client-side supabase mutation can't fire emails (Phase 20 #25 fix)** — `CheckInOutActions.tsx` ตอนแรกทำ `supabase.from('bookings').update({status: 'checked_out'})` ตรงจาก client component (RLS allowed it). Phase 25 ต้อง fire `checkout_thank_you` email หลัง status flip — แต่ Resend API key + admin client (สำหรับ email_log RLS-bypass insert) ทำงานได้เฉพาะ server-side. Fix: สร้าง `app/actions/check-in-out.ts` มี `checkInBookingAction` + `checkOutBookingAction`, refactor component จาก inline supabase update เป็น `await checkOutBookingAction({bookingId})` + `router.refresh()` — server action holds `requireRole()` gate + DB update + email fire-and-forget + audit row ในที่เดียว. หลักการเดียวกันใช้กับ client-side mutation อื่นๆ ที่ต้องการ send email / write to RLS-blocked table / call Resend — ถ้าต้องเพิ่ม email template ให้ mutation ที่เคยทำ client-side, ย้ายมันไป server action ก่อน. Reference: `app/actions/check-in-out.ts:1` + `app/reception/check-in-out/CheckInOutActions.tsx:38-62` (server action call replaces supabase update)

- **Never console.log PII in production (Phase 20 #25 find)** — `lib/email/resend.ts` dev-fallback path originally `console.log`'d the recipient email + subject + full rendered body when `RESEND_API_KEY` was missing. Even though the fallback only fires when Resend is unconfigured, a production deploy with a missing env var would leak guest PII (email addresses) + email body content into stdout / log aggregation. Fix: wrap body logging behind `NODE_ENV !== 'production' && EMAIL_LOG_BODY === '1'` (opt-in), always redact the recipient via `redactEmail()` (e.g. `te***@zenzero.com`), keep the summary line (template + event_key) PII-free. Same rule applies to ANY `console.log` that touches recipient email, phone, name, payment amount, or booking contents. The `email_log` row already records who got what — console.log should only carry diagnostic metadata, never PII. Reference: `lib/email/resend.ts:108-135` (dev-fallback log block)

- **Migration runner skip-on-rerun** — `scripts/run-migrations.mjs:60` regex filters files by number AND tracks applied names in `_applied_migrations`. Re-applying a migration = no-op (not an error). To FORCE a re-apply (e.g. fix-up to a shipped function), the canonical pattern is a new migration file (`20260907_*`) that does `drop function if exists ...` + `create or replace function ...` — NOT a manual drop on the live DB. Caught during Phase 24: first apply of `20260906` was buggy, second attempt was a silent skip; fix was `20260907_fix_cancel_booking_auth.sql` (counted in regex + carries the full body). When iterating on a freshly-shipped RPC, prefer the fix-up migration path

- **listStub pitfall** — wiring dispatcher (`lib/data/manager.ts`) ไม่พอ — ต้องเช็ค `lib/data/supabase-*.ts` ว่า function implement จริง. ตอนนี้ `listCancellationPolicies` + `getReportsData()` analytics arrays (Phase 12) wired ครบแล้ว — เหลือแค่ fields ที่ยังไม่มี source data (เช่น `partial_refund` ที่ไม่มี write path)

- **Next.js 16 server action HTTP test** — POST server action ผ่าน HTTP ต้องใช้ field `$ACTION_ID_<id>` ใน multipart body (ไม่ใช่ `Next-Action` header เหมือนเวอร์ชั่นก่อน). Reference: `scripts/test-phase10-refund-rpc.mts:106-114`

- **SSR HTML comment split** — React SSR แทรก HTML comment ระหว่าง text nodes, e.g. `+<!-- -->12.5<!-- -->%` — regex parse ตัวเลขต้อง `.replace(/<!--[^>]*-->/g, '')` ก่อน. Reference: `scripts/test-phase10-kpi-trend.mts:115-116`

- **USE_MOCK_DATA wrapper** — `useMock` evaluate at module load. แก้ env แล้ว **ต้อง restart dev server** ไม่งั้นทุก action ไป mock-manager.ts (in-memory state, no DB writes) — symptom: HTTP 200 + ไม่มี DB change

- **Admin RLS blocks DELETE on bookings** — admin มีแค่ UPDATE grant (staff policy), ไม่มี DELETE → cleanup test rows ด้วย admin client silent fail. ใช้ `createServiceClient(BASE, SUPABASE_SERVICE_ROLE_KEY)` แทนสำหรับ DELETE step

- **`scripts/` excluded from project tsconfig** — `npm run typecheck` ไม่เช็ค scripts. ต้องใช้ `npx tsx` รัน (type-strip อัตโนมัติ)

- **Hardcoded Supabase pooler region** — Phase 12 ย้าย region ไปอ่านจาก `scripts/_db-connection.mjs` (default `aws-0-ap-southeast-1.pooler.supabase.com`) ผ่าน env var `SUPABASE_POOLER_HOST`. Scripts ที่ใช้ shared helper: `promote-manager`, `query-manager-id`, `check-enum`, `check-target`, `run-add-manager-enum`, `run-sql`. `check-cols.mjs` ใช้ `pgDirectConnectionString()` กับ direct host. ย้าย region = แก้ env var เดียว

- **Hardcoded manager UID** ใน `scripts/promote-manager.mjs` — Phase 12 รองรับ `MANAGER_ID` env var (direct) หรือ `MANAGER_EMAIL` env var (resolve ผ่าน `auth.users` lookup). ถ้าไม่ตั้งค่าเลย จะ fall back ไปใช้ legacy literal `ba4b825d-3dec-4db0-b604-82f20c8cb165`

- **`getRoomTypes` + `getFloors` ใน `rooms.ts:27,31` ใช้ mock เสมอ** — ถึงแม้ `USE_MOCK_DATA=0`. Filter dropdown + floor dropdown break ถ้าไม่มี mock data

- **RBAC redirect target (Phase 11 fix)** — `redirect('/')` ใน wrong-role guard ทำให้ staff ตกไปที่ User homepage แล้ว browse User pages ได้. ทุก wrong-role redirect ต้องใช้ `roleHomePath(session.role)` จาก `lib/supabase/getSession.ts` เสมอ — admin → `/admin`, manager → `/manager`, reception → `/reception`, housekeeper → `/housekeeper`, user → `/`. ใช้แล้วใน: `proxy.ts:72-93,99-104`, 4 staff portal layouts, 10 `requireXxx` helpers ใน `app/actions/*`, `(booking)/layout.tsx` (User-only gate). เพิ่ม role ใหม่หรือหน้าใหม่ต้อง update `roleHomePath()` + เพิ่ม route ใน proxy.ts `staffPaths` (หรือสร้าง role-specific layout).

- **Migration runner regex** — `scripts/run-migrations.mjs:54` มี alternation literal ของหมายเลข migration ที่อนุญาต (`/202608(27|29|30|31|32|33|34)_.*\.sql$/`). Migration ใหม่ที่หมายเลขอยู่นอก alternation จะถูก silently skip — `node scripts/run-migrations.mjs` exit 0 แต่ไม่ apply อะไร. ต้องเพิ่มหมายเลขใน regex ก่อนสร้างไฟล์ migration ใหม่เสมอ

- **Backing booking columns (Phase 12)** — `bookings.channel` (default `'web'`, check constraint web/walk_in/phone/ota) และ `bookings.room_unit_id` (nullable FK → `room_units`) ต้องการ migration `20260834_bookings_channel_and_unit.sql`. Reception check-in ต้อง select unit จาก `<select>` ก่อน update — ถ้าไม่ใส่ `room_unit_id` ตอน check-in, `/manager/bookings` จะแสดง "—" แทน unit label. ตัว service-role action `createWalkInBooking` ตั้ง `channel='walk_in'`, `createBooking` ตั้ง `channel='web'`; ถ้ามี OTA/phone channel ต้องเพิ่มเส้นทาง insert ใหม่

- **Pricing defaults vs DB (Phase 12 + Phase 16)** — `lib/pricing.ts:DEFAULT_PRICING` คงค่า 0.07 / 150 ไว้เป็น fallback สำหรับ client preview (BookingWidget, WalkInForm). ทุก server-action caller ใหม่ของ `calculatePrice` ต้อง pass `settings` จาก `getHotelSettings()` เสมอ — ใช้ `getPricingConstants()` ใน `lib/data/manager.ts` แทน extract block เอง (Phase 16 extracted). Wired แล้วใน: `app/actions/booking.ts`, `app/actions/walk-in-booking.ts`, `app/(booking)/bookings/new/page.tsx` → `BookingForm`. `BookingForm` แสดง label เป็น `${Math.round(settings.taxRate * 100)}%` และ `${formatTHB(settings.resortFeePerNight)}/คืน` — ห้าม hardcode "ภาษี 7%" กลับเข้าไป

- **Shared DB helper (Phase 12)** — `scripts/_db-connection.mjs` อ่าน `SUPABASE_POOLER_HOST` (default `aws-0-ap-southeast-1.pooler.supabase.com`) + `SUPABASE_DB_PASSWORD` + parse project ref จาก `NEXT_PUBLIC_SUPABASE_URL`. Export `pgPoolerConfig()` (pooler สำหรับ queries ทั่วไป) และ `pgDirectConnectionString()` (direct host + SSL `scripts/.supabase-ca.crt` สำหรับ migration runner). Region migration = แก้ env var เดียว. Scripts ที่ห้าม reconnect ผ่าน helper คือ `run-migrations.mjs` (ใช้ direct SSL) — pattern อื่นๆ ที่ต้องการ PG connection ใหม่ให้ใช้ helper เสมอ

- **Password leak (Phase 12 fix)** — `scripts/check-cols.mjs` ไม่มี literal password แล้ว (rename จาก `.mts` + ใช้ `pgDirectConnectionString()`). **แต่ password ที่เคย leak ต้อง rotate ที่ Supabase dashboard ทันที** ก่อน commit Phase 12. ถ้าเจอ literal password ใน script ไหนก็ตามหลัง Phase 12 = rotation needed immediately + git history scrub. ใช้ `git grep -n "<password-pattern>" .` ก่อน commit scripts ใหม่ทุกครั้ง

- **Silent server-action errors with `useTransition`** — `void signInWithXxx()` discards the action's `{ error }` return → user sees a silent failure (spinner stops, no message). Fix: `const result = await signInWithXxx(); if (result?.error) setState(result.error)` + add the state to the existing `displayError` chain (e.g. `state?.error ?? errorMessage ?? googleError`). Surfaced in Phase 14 follow-up when Google OAuth silently failed due to dashboard misconfig — only visible via raw Supabase JSON in the network tab. หลักการเดียวกันใช้ได้กับ server action อื่นๆ ที่ trigger จาก `onClick` + `useTransition` ไม่ใช่แค่ OAuth

- **Google OAuth: provider not enabled** — ถ้า click "เข้าสู่ระบบด้วย Google" แล้วเจอ error `"Unsupported provider: provider is not enabled"` แปลว่ายังไม่ได้ enable Google provider ใน Supabase Dashboard. Fix ทำที่ dashboard ไม่ใช่ในโค้ด: Supabase Dashboard → Authentication → Providers → Google → toggle ON + paste OAuth Client ID/Secret จาก Google Cloud Console. Setup steps ครบที่ plan file `fancy-hopping-dawn.md` (Phase 14 follow-up section)

- **PostgREST schema cache lag after migration (Phase 12)** — `scripts/run-migrations.mjs` และ `scripts/run-sql.mjs` ใช้ direct host (`pgDirectConnectionString()` / pooler) ซึ่ง **bypass PostgREST's `pg_listening_channels()` watcher** → cache stays stale จนกว่าจะ reload manually. Symptom: query embed (`room_unit:room_units(...)`) throws `Could not find a relationship between 'X' and 'Y' in the schema cache` ทั้งๆ ที่ FK มีใน DB (ตรวจด้วย `SELECT conname FROM pg_constraint WHERE conrelid='public.X'::regclass AND contype='f'`). Fix หลัง apply migration ใหม่ทุกครั้ง:
  ```sql
  NOTIFY pgrst, 'reload schema';
  ```
  รันผ่าน `node scripts/run-sql.mjs <notif-file>.sql` หรือ Supabase SQL Editor. รอ ~5s แล้ว PostgREST จะ re-read `pg_catalog` และ embed ได้ปกติ. Reference: `db-schemas/20260834_bookings_channel_and_unit.sql` (first symptom reported for `bookings.room_unit_id` → `room_units.id` — `/manager/bookings` page error `Supabase (bookings): Could not find a relationship between 'bookings' and 'room_units' in the schema cache` ที่ `lib/data/supabase-manager.ts:508-522`). **First-debug step**: verify FK actually exists ก่อน — ถ้า migration ไม่เคย apply จริง (column ไม่มี) reload cache อย่างเดียวไม่ช่วย ต้อง apply migration ก่อนแล้ว NOTIFY ตาม

- **Use canonical `formatTHB()` from `lib/pricing.ts:143`** — never shadow with local `formatPrice`/`formatTHB` helpers or inline `toLocaleString('th-TH') + ' THB'` patterns. Local helpers silently drift on currency/locale swap (e.g. Phase 17 refactor swept 6 files: `RoomCard.tsx:15`, `RoomTypesAdminTable.tsx:9-11`, `SeasonalRatesAdminTable.tsx:19`, `PromotionsAdminTable.tsx:17`, `RoomInventoryTable.tsx:42-44`, `SeasonalRatesPreview.tsx:17`). Use the canonical `formatTHB` for base prices, `formatDiscount(p)` for promotion discounts (handles percent/flat), and the inline `${formatTHB(amount)}/คืน` template for seasonal flat rates

- **Wrap `<Image>` with `<RoomImage>` for user-facing hero/gallery** — `lib/r2/publicUrl.ts` returns empty string on null `imageKey`, and a Next `<Image>` with empty src renders raw alt text on grey background (visual noise + accessibility leak). `<RoomImage>` (client component) handles both empty src AND 404/network errors via gradient + MaterialIcon fallback. Consumer wrapper must be `relative` + sized (e.g. `aspect-[4/3]`) — both `<Image>` and fallback use `absolute inset-0`. Used in `RoomCard`, `app/reception/bookings/new/page.tsx`, `RoomGallery` (hero + 4 thumbs)

- **RoomCard layout stability (price drift + description collapse)** — ห้ามใช้ `flex items-end` หรือ `flex items-baseline` คู่กับ typography price text + fixed-height round button (arrow pill drops on 5+ digit prices), และ ห้ามใช้ bare `<p className="line-clamp-2">` description โดยไม่ pin height (short desc ทำให้ section อื่นเลื่อนขึ้น). Fix ต้องครบทั้งสองแกน: (1) price row: `flex items-center` + `whitespace-nowrap` บน price span + `flex-shrink-0` บนปุ่ม + `min-w-0` บน text column + `gap-3`; (2) card structure: `<Link>` ต้อง `flex flex-col` + content wrapper `<div>` ต้อง `flex-1` + description `<p>` ต้อง `flex-1 mb-0` (absorbs leftover space, doesn't shift other sections). Affects `components/room/RoomCard.tsx:19,39,43,49` (primary: covers `/rooms` + `/`) และ `app/reception/bookings/new/page.tsx:35,49,51,54` (walk-in picker). ใช้ `grid grid-cols-N` ปกติจะให้ `align-items: stretch` ทำให้ card สูงเท่ากันอัตโนมัติ — แต่ต้องเปิด `flex flex-col` บน `<Link>` ก่อน ไม่งั้น content wrapper ไม่รู้จัก available space

- **Stripe webhook security (Phase 17)** — never `auth.getUser()` ใน `/api/*` route handlers (Stripe ไม่มี cookie); verify HMAC ผ่าน `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` แทน. ใช้ `await request.text()` สำหรับ raw body — `request.json()` จะ re-serialize และ break signature. ทุก webhook-driven DB write ผ่าน SECURITY DEFINER RPC (`confirm_payment_session(text,text,text)`, `expire_payment_session(text,text)`, `confirm_refund_session(text,text)` — Phase 18) — bookings RLS ไม่ยอมให้ `service_role` write `payment_status` โดยตรง (จะ bypass audit trail), และ RPC ให้ atomic idempotency ผ่าน `provider_event_id` UNIQUE. Pattern mirror: `approve_refund(uuid)` ที่ `db-schemas/20260833_approve_refund_rpc.sql`. Stripe-specific gate คือ env flag `hasPaymentGateway` (mirrors `hasSupabase`/`hasR2`) — actions early-return เมื่อ false. `createCheckoutSessionAction` ไม่มี `requireRole()` เพราะ RPC enforce owner/staff เอง (reception/manager/admin ต้องใช้ action เดียวกันกับ walk-in flow); walk-in cash ใช้ `markCashPaidAction` แยก + `requireRole(['reception','manager','admin'])`. Migration `20260902_*` และ `20260903_*` ต้องเพิ่มใน `scripts/run-migrations.mjs:54` regex ก่อนสร้างไฟล์ (มิงั้น silently skipped — Phase 12 pitfall). Deleted `markPaid` stub เพราะ owner RLS gap ทำให้ mark ตัวเองว่า paid โดยไม่จ่ายเงินจริง (motivation ของ Phase 17)

- **Stripe refund action ordering (Phase 18)** — NEVER flip `bookings.payment_status='refunded'` ใน DB ก่อนเรียก `stripe.refunds.create()`. ถ้า Stripe call fail (network, expired PI, declined), DB จะบอก "refunded" แต่ guest's card ไม่ได้คืนเงิน — half-refund แก้ไม่ได้ (Phase 18 critical pitfall). Order เสมอ: (1) read refund_request + linked Stripe payment, (2) call `stripe.refunds.create({ payment_intent, amount? }, { idempotencyKey: buildRefundIdempotencyKey(refundId) })`, (3) then call `approve_refund` RPC. ถ้า Stripe throws → `actionFail(e, 'Stripe refund failed: …')` และ STOP — DB stays untouched, manager retry ได้. Partial-refund: action เทียบ `refund_requests.amount < payments.amount` หลัง RPC แล้ว override `bookings.payment_status='partial_refund'` โดยตรง (RPC เขียน 'refunded' เสมอ — partial_refund เป็น action-layer override ตาม D2). `buildRefundIdempotencyKey(refundId)` returns `refund:${refundId}` — Stripe SDK 24h window ป้องกัน double-charge จาก manager click ซ้ำ. Webhook RPC `confirm_refund_session` idempotent ผ่าน `provider_event_id` UNIQUE เหมือน payment flow

---

## 📌 Known Issues / TODO

### Code-level TODOs
**No `TODO`/`FIXME`/`HACK`/`XXX` markers found** ใน `app/`, `components/`, `lib/`, `data/`, `supabase/migrations/`, `scripts/`, หรือ config files (verified by grep 2026-08-25)

### Known gaps (documented in code as comments)
1. **`partial_refund`** enum value exists but no code path writes it
2. **`no_show`** was added to `booking_status` enum live (DB), not in migration file
3. **`refund_requests` no INSERT policy** — created by booking cancel flow (out of scope for Phase 9)
4. **Phase 7/8 admin pages** still have some pages that may not have all CRUD wired — verify before extending

### Soft issues
- `data/mock-manager.json` + `data/mock-reviews.json` ยังใช้ hardcoded test UIDs (`u-house-1`, `u-recep-1`) — `mock-housekeeper.ts` เปลี่ยนเป็น env-driven แล้ว (Phase 12) แต่ JSON files อ่าน env ไม่ได้ (pure data) — แปลงเป็น TypeScript stub ถ้าต้องการ parity
- `scripts/check-cols.mjs` no longer holds a literal password (Phase 12 — uses `pgDirectConnectionString()` from shared helper) — **แต่ password ที่เคย leak ต้อง rotate ที่ Supabase dashboard ทันที**

---

## 🔭 Future Work / Backlog (Phase 19-20)

**Last gap analysis**: 2026-09-03. 16 pending tasks saved in `TaskList` (IDs #17-#32). Plan file: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`.

### Phase 19 — Stripe deferred items (from Phase 18 plan tail)
| Task | Item | Prereq |
|---|---|---|
| #17 | `payments.amount` backfill from `bookings.total` + CHECK (amount > 0) | none |
| #18 | Webhook race fix for `partial_refund` (RPC preserves existing status) | none |
| #19 | Multi-refund on same booking (aggregate refunds vs `payments.amount`) | #17 + #18 |
| #20 | Admin Stripe settings UI (masked keys + webhook log) | new table |
| #21 | Multi-currency wire `hotel_settings.currency` | large refactor |
| #22 | Direct PaymentIntent + 3DS (`payment_intent.requires_action`) | defer |

### Phase 20 — Production-launch blocks (Top 10 critical)
| Task | Block | Severity | File:line |
|---|---|---|---|
| #23 | **Overbooking prevention** | 🔴 Critical | `app/actions/booking.ts:36-78` validateแค่ `is_active + max_guests` — ไม่เช็ค availability, 0 EXCLUDE/gist constraints |
| #24 | **Cancellation policy enforcement** | 🔴 Critical | `app/actions/booking.ts:178-193` แค่ set `cancelled` — ignore `free_cancel_hours` + `refund_pct` ที่มีอยู่ |
| #25 | **Email infrastructure** | 🔴 Critical | 0 hits: resend/sendgrid/nodemailer/postmark/ses — ไม่มี confirmation/receipt/refund notice |
| #26 | **Notification layer** | 🟠 High | Staff bell `TopNavBar.tsx:34-39` dead button — ไม่มี `notifications` table |
| #27 | **CI/CD + automated tests** | 🟠 High | 0 `.github/`; 1 unrunnable test (`lib/pricing/seasons.test.mts`); 30 manual smoke scripts |
| #28 | **Error monitoring + analytics** | 🟠 High | 0 Sentry/PostHog/Plausible — money paths invisible |
| #29 | **App-level rate limiting** | 🟠 High | Only Supabase built-in auth throttle — login/register/search unthrottled |
| #30 | **Compliance + 404 fixes** | 🟠 High | No 2FA/GDPR/cookie consent + 3 live 404s (`/privacy`, `/terms`, `/about`) |
| #31 | **Document generation (PDF/Excel)** | 🟡 Medium | Dead buttons `reports/page.tsx:26-39` — 0 jspdf/react-pdf |
| #32 | **i18n + shift scheduling UI** | 🟡 Medium | TH/EN toggle dead (`TopNavBar.tsx:61-73`); `staff_shifts` read-only grid |

### Quick wins (≤1 commit, no breaking change)
- **#30 (404 fix only)** — add stub `/privacy`, `/terms`, `/about` pages (~30 min)
- **#28 (Sentry only)** — install SDK + wire `global-error.tsx` (~30 min)
- **#17 (Phase 19-A)** — SQL migration only, no code change (~15 min)

### Recommended Phase 20 sequence (when resumed)
**Block 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10** per criticality. Block 1 (overbooking) is the only correctness bug in shipped code; Block 2-3 close contractual/UX gaps; Block 4-10 are hardening for production.

### Reference files (gap evidence)
- Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md` (full Top 10 + 7-category audit)
- Phase 18 master plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md` (Phase 19 deferred items)

---

## 📜 Memories (cross-session context)

Saved memories in `~/.claude/projects/Y--Final/memory/`:
- `nextjs16-call-server-action-via-http.md` — `$ACTION_ID_<id>` field pattern
- `zenzero-gitignore-pushed.md` — .gitignore now committed (since 2026-08-22)
- `zenzero-local-only-files.md` — list of files kept in working tree only
- `zenzero-liststub-pitfall.md` — check supabase-*.ts for `return []` stubs
- `zenzero-rls-recursion-fix.md` — use is_staff()/has_role() helpers
- `zenzero-phase9-live-verified.md` — 43/43 smoke tests passed
- `zenzero-usemock-data-wrapper.md` — env change needs dev server restart
- `zenzero-test-cleanup-needs-service-role.md` — admin RLS blocks DELETE

---

## 🔍 Quick File Pointers

| Need to find | Path |
|---|---|
| Role-based redirects | `proxy.ts:1` + `lib/supabase/proxy.ts:42-103` |
| **Single source of truth for role → home-path** | `lib/supabase/getSession.ts:roleHomePath()` |
| Per-role layout re-check | `app/{role}/layout.tsx`, `app/(booking)/layout.tsx` |
| Server action template | `app/actions/auth.ts` |
| Pricing logic | `lib/pricing.ts`, `lib/pricing/seasons.ts` |
| Supabase clients | `lib/supabase/server.ts`, `client.ts`, `proxy.ts`, `admin.ts`, `getSession.ts` |
| **RBAC `requireRole` helper** | `lib/auth/require.ts` (consolidates 11 `requireXxx` — Phase 16) |
| **Supabase error helpers** | `lib/errors/supabase.ts` (`wrapSupabaseError` + `actionFail` — Phase 16) |
| **Shared UUID validator** | `lib/ids.ts` (`UUID_RE` + `isUuid` — Phase 16, replaces 2 duplicate defs) |
| **`sanitizeNext` helper** | `lib/auth/sanitize.ts` (relocated from `app/auth/next-utils.ts` — Phase 16) |
| **Refactor plan file** | `C:\Users\suns9\.claude\plans\nifty-chasing-raccoon.md` (9-commit execution log + deferred items) |
| Mock data toggle | `lib/data/manager.ts:4`, `lib/data/rooms.ts:2`, `lib/env.ts` |
| R2 image URLs | `lib/r2/publicUrl.ts` |
| Design tokens | `app/globals.css` (`@theme {}`) |
| Migration runner | `scripts/run-migrations.mjs:53-55` (filter regex) |
| RLS helpers | `db-schemas/20260820_fix_rls_recursion.sql:7-34` |
| Refund RPC | `db-schemas/20260833_approve_refund_rpc.sql:18` |
| Booking constraint | `db-schemas/20260819_bookings.sql:47` (`chk_dates`) |
| Housekeeping trigger | `db-schemas/20260821_housekeeping_tasks.sql:28` |
| **RBAC test suite** | `scripts/test-phase11-rbac.mts` (48/48 passing) |
| **RBAC fixture setup** | `scripts/_rbac-fixture.mts` (idempotent — resets test user roles + creates missing staff users) |
| **OAuth callback route** | `app/auth/callback/route.ts` (exchange code → set session cookie → redirect by role) |
| **Google sign-in server action** | `app/actions/auth.ts:signInWithGoogle()` + LoginForm/RegisterForm `handleGoogle` |
| **Google OAuth provider setup** | Supabase Dashboard → Authentication → Providers → Google (toggle ON + paste OAuth Client ID/Secret จาก Google Cloud Console) |