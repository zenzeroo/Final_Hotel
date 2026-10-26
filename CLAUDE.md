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

เมื่อเจอ bug / error / unexpected behavior แล้วแก้ได้สำเร็จ ต้องเพิ่ม bullet ลง `docs/pitfalls.md` ทันที — format:
```
- **<short name>** — <symptom/error> → <fix + reason>
```
ถ้าเป็นกฎที่ใช้กว้าง (กระทบหลายส่วนของโค้ด) ให้เพิ่มบรรทัดสั้นๆ ใน `## 🪤 Pitfall Index` ด้านล่างด้วย
อย่าบันทึก error ที่แก้ง่าย (typo, missing import) หรือ one-off issue ที่ไม่กระทบ pattern

### R2 — Ask Before Git Commit / Push

ทุกครั้งที่จะ `git commit` หรือ `git push` ต้องถาม user ให้อนุมัติก่อนเสมอ — ห้ามทำเองโดยไม่ได้รับ explicit approval

- ก่อน commit: รวบรวมไฟล์ + แสดง diff stat + commit message → ถาม "OK to commit?"
- ก่อน push: ระบุ branch ปลายทาง → ถาม "OK to push to <remote>/<branch>?"
- Exception: user ระบุ "commit แล้ว push" พร้อม message/branch ในคำสั่งเดียว → ทำได้ทันที

---


## 📊 Current State

**HEAD**: `1428967` on `notmain` (Phase 62 + the /rooms search-bar, multi room-type and /bookings no-show changes uncommitted). All DB migrations through `20261020` are applied live, except `20261007_bkk_today_helper.sql` (staged for review on purpose, nothing calls `bkk_today()`). `booking_holds` table no longer exists (dropped in Phase 42).

Full phase history (phases 1–62, one row each): `docs/phases-done.md` → section "Status table". Latest phases:
- **55** — guest refund request (`request_refund`), booking stays confirmed until manager approves; refund-history tab on `/bookings`.
- **56** — unpaid web bookings expire after 5 + 5 min (`pg_cron` every minute); capacity ignores overdue unpaid rows; `PaymentCountdown`.
- **57 / 57b / 57c** — one refund rule for guests and staff: full refund if asked ≥ `refund_min_days_before_checkin()` (= 2) days before check-in (Bangkok); shown before payment (widget, form checkbox, Stripe, emails). `cancellation_policies` no longer affect refunds.
- **58** — expired-payment button: choose another room / retry (`retryExpiredBookingAction`).
- **59** — room gallery layout by photo count + `ImageLightbox`; amenities section removed from guest room page.
- **60** — CI (`.github/workflows/ci.yml`: lint, typecheck, `npm run test:unit`, build) + in-app realtime notifications (`notifications` table, `lib/notifications/notify.ts`, `NotificationBell`).
- **61** — PDPA consent: required terms/privacy checkbox + optional marketing on `/register` (`components/consent/ConsentCheckboxes.tsx`); `profiles.terms_version`/`marketing_opt_in` + append-only `consent_events` (`20261018`), written only by `recordConsent()` (admin client); `PRIVACY_POLICY_VERSION` in `lib/consent.ts` — customers on an older/no version are sent to `/consent` by `lib/supabase/proxy.ts` (GET `/bookings`, `/account`) and by the booking actions (`redirectIfConsentMissing`); staff never gated. Marketing switch on `/account/profile`; `/privacy` rewritten (TH/EN, retention, `privacy@zenzerohotel.xyz`). Test: `scripts/test-phase61-consent.mts` 8/8 (needs dev server).
- **62** — admin-uploaded legal PDFs at `/admin/legal`: 4 docs (privacy/terms × TH/EN) uploaded as a draft (`legal_draft` singleton), previewed, published once via `publish_legal_version()` RPC → append-only `legal_versions` (`20261019`; atomic draft swap `set_legal_draft_key()` in `20261020`). **The consent version is the newest `legal_versions.version`** (`getCurrentConsentVersion()` / `fetchCurrentLegalVersion()` + `consentVersionOf()`); `PRIVACY_POLICY_VERSION` is only the fallback while the table is empty (JSX `/privacy`, `/terms` shown then). Every publish = everyone re-consents. Forms post `legal_version`; signUp / `acceptConsentAction` refuse a stale one (`consent.versionChanged`). PDFs served same-origin by `app/legal-files/[doc]/route.ts` (`?v=<id>` immutable, `?v=draft` admin only) and rendered by `components/legal/PdfViewer.tsx` (react-pdf 10.5 / pdfjs 5.4) on `/privacy`, `/terms` and in `LegalDocModal` from `ConsentCheckboxes`. Test: `scripts/test-phase62-legal-docs.mts` 12/12 (needs dev server + empty `legal_versions`; publishes a test row on the live DB while it runs).

## 🔭 Open Items

| Priority | Item |
|---|---|
| 🔴 Verify | Supabase Dashboard "Allow manual linking" = ON (Phase 37). Check: `npx tsx scripts/test-phase37-identity-linking.mts` case 5 must not say `"Manual linking is disabled"`. |
| 🟡 Open | Phase 54 integration test (shift set → housekeeper on shift; orphan room → exactly one task; re-run idempotent). |
| 🟡 Open | `app/actions/admin/*` error strings are Thai-only. |
| 🟡 Open | Backlog: PDF generation, 2FA / GDPR cookie consent, error monitoring (Sentry), hero-slide edit modal, loyalty — see `docs/phases-upcoming.md`. |
| 🔵 Manual | Vault secrets `app_url` + `cron_secret` and Vercel `CRON_SECRET` (Phase 56) — without them Stripe pages of expired bookings stay open up to 30 min. |

**Where to look:** `docs/PROJECT-STATUS.md` (snapshot), `docs/phases-done.md` (history + status table), `docs/phases-upcoming.md` (backlog + known issues), `docs/pitfalls.md` (all gotchas), `docs/archive/CLAUDE-2026-10-23-full.md` (this file before it was slimmed), plans in `C:\Users\suns9\.claude\plans\` (local).

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
| Email | `resend` + `@react-email/components` | (latest) | Transactional email — booking confirm/receipt/cancel/refund/thank-you. `lib/email/resend.ts` writes `email_log` row first, then sends. Dev fallback: `console.log` when `RESEND_API_KEY` empty. |
| Export | `exceljs` | (latest) | `app/api/manager/reports/export/route.ts` — streams `getReportsData()` as 6-sheet `.xlsx`. |
| Dev | `eslint` | `^9` | Flat config + Next.js presets |
| Dev | `pg` | `^8.23.0` | Direct Postgres for migration runner |
| Dev | `dotenv` | `^16.6.1` | `.env.local` loading for scripts |

**Node version requirement**: ไม่ pin ใน `package.json` — แนะนำ Node ≥ 20.x (Next.js 16 minimum); CI ใช้ Node 22

---

## 🎨 Coding Conventions (observed in code)

### File naming
- **Pages**: `app/<route>/page.tsx` — lowercase, kebab-case for nested dirs
- **Layouts**: `app/<route>/layout.tsx` — same as page
- **Server actions**: `app/actions/<topic>.ts` หรือ `app/actions/admin/<topic>.ts` — every file starts with `'use server'`
- **Data wrappers**: `lib/data/<domain>.ts` — thin re-export from `supabase-<domain>.ts` (mock layer deleted)
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

### Mock vs real data
Mock layer deleted. Every `lib/data/<domain>.ts` is a thin re-export from `supabase-<domain>.ts`. To debug a function, go straight to the Supabase impl. The amenity slug catalog for the admin room-type form lives in `lib/data/supabase-rooms.ts:getAmenityCatalog`.

### Component patterns
- **Server Components** for data fetching + tables + forms with no interactivity
- **Client Components** (`'use client'`) for forms, dropdowns, modals, action buttons (e.g. `ApproveRefundButton`, `TaskClaimButton`)
- 34/ 82 components are client components
- **Force-dynamic** directive ทุก page ที่ fetch user data (per R1 pitfalls)

---

## 🗄️ Database Schema (summary)

**Pointers**:
- `Y:\Final\db-schemas\` — 48 migrations + 2 seeds (canonical SQL, byte-identical to `supabase/migrations/`)
- `Y:\Final\db-schemas\schema-documentation.docx` — Thai Word doc (17 tables + 11 enums + 4 SECURITY DEFINER fns + triggers + RLS summary)
- `Y:\Final\db-schemas\drawio-prompt.txt` — 3 formats for ER diagram (Mermaid ER / draw.io CSV / natural-language prompt)

### Tables (20)
- `profiles` — auto-populated from auth.users via `handle_new_user()` trigger
- `room_types`, `amenities` — public catalog
- `room_units` — physical rooms, status CHECK (available/occupied/cleaning/maintenance/out_of_order/**waiting_cleaning/inspection/ready/checkout** — 9 values since `20260920_housekeeping_allocation.sql`)
- `bookings` — `check_out > check_in` CHECK constraint; `booking_status` + `payment_status` enums
- `reviews` — `status` (pending/approved/hidden); avg/count recalc by trigger
- `cancellation_policies` — public read
- `promotions` — public read active; admin/manager write
- `housekeeping_tasks` — type/status/priority enums; triggers sync `room_units.status`
- `maintenance_reports` — issue_type/severity/status; `<strike>auto-flips critical → maintenance</strike>` — **Phase 31**: auto-flip trigger dropped (`20260922`); manager confirms closure via `confirmMaintenanceRoomClosure`
- `booking_events` — audit log (created/confirmed/checked_in/checked_out/cancelled/note_added/refund_approved)
- `guest_notes` — request/complaint/compliment/general
- `damage_reports` — staff read/insert; manager+admin resolve
- `refund_requests` — staff read; manager+admin decide (no INSERT policy — created by booking cancel flow)
- `hotel_settings` — singleton row (id=1); admin write
- `seasonal_rates` — date-range overrides (flat_price OR price_multiplier, min_nights_override, priority)
- `payments` — Stripe/cash payments (`20260902`); `provider_event_id` UNIQUE idempotency, `amount > 0` CHECK
- `email_log` — `20260908`; `event_key` UNIQUE dedup, FK on delete SET NULL
- `floor_assignments` — `20260918`; per-floor persisted housekeeper default
- `staff_shifts` — staff_id+shift_date PK; morning/afternoon/evening/off

### Enums (11)
| Enum | Values | Where |
|---|---|---|
| `room_type_enum` | Deluxe, Suite, Villa | `20260818_init.sql:11` |
| `bed_type_enum` | King, Queen, Twin | `20260818_init.sql:15` |
| `booking_status` | pending, confirmed, checked_in, checked_out, cancelled, temp_pending, expired | `20260819_bookings.sql:8` + `20261004_1` |
| `payment_status` | unpaid, paid, refunded, partial_refund | `20260819_bookings.sql:12` |
| `user_role` | user, reception, housekeeper, admin, manager | `20260820_staff_role.sql:8` + ALTER `20260825:8` |
| `housekeeping_task_type` | cleaning, turn_down, deep_clean, inspection, restock | `20260821:2` |
| `housekeeping_task_status` | unassigned, assigned, in_progress, completed, cancelled | `20260821:3` |
| `housekeeping_task_priority` | low, normal, high, urgent | `20260821:4` |
| `maintenance_issue_type` | plumbing, electrical, hvac, furniture, appliance, other | `20260822:1` |
| `maintenance_severity` | low, medium, high, critical | `20260822:2` |
| `maintenance_status` | open, in_progress, resolved | `20260822:3` |

### SECURITY DEFINER functions (11 — RLS bypass + atomic logic)
| Function | Signature | Purpose |
|---|---|---|
| `handle_new_user()` | `() RETURNS trigger` | Auto-insert profile on auth signup (mirrors email/hired_at; rewritten `20260832`) |
| `is_staff()` | `() RETURNS boolean` | True iff role ∈ (reception, housekeeper, manager, admin) |
| `has_role(text)` | `(text) RETURNS boolean` | True iff role = check_role |
| `approve_refund(uuid)` | `(uuid) RETURNS refund_requests` | **Phase 10** — atomic manager approval + booking payment_status flip + double-decision guard |
| `create_booking(uuid,uuid,date,date,...)` | `(uuid, uuid, date, date, ...) RETURNS bookings` | **Phase 20 #23** — overbooking prevention: `FOR UPDATE` lock on room_units pool + overlap count under `daterange &&` (see `docs/pitfalls.md`) |
| `cancel_booking(uuid, boolean, numeric)` | `(uuid, boolean, numeric) RETURNS TABLE(...)` | **Phase 20 #24 → 57b** — locks booking, applies the 2-day refund rule (no longer the policy table), flips status, inserts refund_requests + audit row (see `docs/pitfalls.md`) |
| `create_payment_session(text,text,text)` | `(text, text, text) RETURNS payments` | **Phase 17** — Stripe checkout session; owner/staff only; webhook-driven status via `confirm_payment_session` |
| `confirm_payment_session(text,text,text)` | `(text, text, text) RETURNS payments` | **Phase 17** — webhook idempotent confirm (via `provider_event_id` UNIQUE) |
| `expire_payment_session(text,text)` | `(text, text) RETURNS payments` | **Phase 17** — webhook idempotent expire |
| `confirm_refund_session(text,text)` | `(text, text) RETURNS refund_requests` | **Phase 18** — webhook `charge.refunded` branch; Phase 19 #19 aggregates multi-partial refunds |
| `allocate_housekeeping_tasks(jsonb, boolean)` | `(jsonb, boolean) RETURNS TABLE(...)` | **Phase 30** — LPT/Min-Load auto-allocation; `FOR UPDATE SKIP LOCKED` + `WHERE status='unassigned'` (manager/admin only) |

### Non-SECURITY-DEFINER utility triggers
- `touch_updated_at()` — generic BEFORE UPDATE updated_at setter
- `recalc_room_rating()` — recomputes room_types.avg/count from approved reviews only
- `reviews_guard_staff_update()` — BEFORE UPDATE blocks staff from modifying protected review fields
- `on_task_status_change()` — syncs room_units.status with task lifecycle (fires on UPDATE OF status only)
- `on_booking_checked_out()` — **Phase 28** (`20260918`): auto-creates unassigned cleaning task on `bookings.status='checked_out'`, guards `room_unit_id IS NOT NULL AND auth.uid() IS NOT NULL` (service-role skip), SECURITY DEFINER + `set search_path = public`
- `on_task_insert()` — **Phase 31** (`20260923`): AFTER INSERT task → maps room status (inspection → 'inspection'; cleaning/turn_down/deep_clean/restock → 'waiting_cleaning'); guards skip occupied/maintenance/out_of_order/cleaning/inspection
- `before_refund_request_update()` — **Phase 29** (`20260919`): auto-stamps `decided_at` + `decided_by` when status flips away from 'pending' (defensive for RLS-bypass UPDATEs)
- ~~`on_maintenance_insert()`~~ — **Phase 31 dropped** (`20260922`): critical-severity no longer auto-closes the room (bypasses manager review) — manager confirms via `confirmMaintenanceRoomClosure`

---

## 🔑 Business Logic — must-know rules

### Booking rules
- **Date check**: `check_out > check_in` enforced by CHECK constraint (`20260819_bookings.sql:47`)
- **Pricing** (`lib/pricing.ts`):
  - `calculateNights(checkIn, checkOut)` — date-fns `differenceInCalendarDays` (≥0)
  - `calculatePrice()`: `baseSubtotal = nights × basePrice`; `feeTotal = nights × 150`; `taxTotal = round((baseSubtotal - discount) × 0.07)`; `total = baseSubtotal - discount + tax + fee`
  - 0.07 / 150 are `DEFAULT_PRICING` fallbacks for client previews; server actions pass `getPricingConstants()` (from `hotel_settings`)
- **Seasonal-aware pricing** (`lib/pricing/seasons.ts`):
  - `pickSeasonalRate(rates, date)` — highest-priority active rate whose date range contains `date`
  - `quoteStay()` — per-night breakdown with applied rates + baseSubtotal
  - `violatesMinNights()` — throws if any applied rate has `min_nights_override > quote.nights`
- **Booking code** format: `ZZR-` + 5 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`pricing.ts:128`)

### Booking lifecycle (booking_status)
1. **temp_pending** — guest clicks ยืนยันการจอง on `/rooms/[id]` → `createTempBookingAction`; held by a heartbeat lease (Phase 42 + 50)
2. **confirmed** — `completeTempBookingAction` (web, `payment_status='unpaid'` with a `payment_due_at` deadline) or walk-in (paid at desk, no deadline)
3. **expired** — hold lapsed or payment deadline passed (`lapsed_reason`; `pg_cron` every minute, Phase 56)
4. **checked_in** / **checked_out** — reception `checkInBookingAction` / `checkOutBookingAction`
5. **cancelled** — `cancel_booking` RPC (guest unpaid, staff) or `approve_refund` (paid guest refund)
- Live enum (verified 2026-10-16): pending, confirmed, checked_in, checked_out, cancelled, temp_pending, expired. **`no_show` and `payment_expired` do not exist.**

### Payment lifecycle (payment_status)
- `unpaid` → `paid`: Stripe webhook (`confirm_payment_session`) or cash (`markCashPaidAction`)
- `paid` → `refunded` / `partial_refund`: `approve_refund(uuid)` aggregates approved refunds vs succeeded payments (Phase 19 #19)
- Late payment on a cancelled/expired booking → webhook auto-refund

### Room status lifecycle (room_units.status, 9 values)
- `available`/`ready` → `occupied` (check-in)
- check-out → `waiting_cleaning` + unassigned cleaning task (`on_booking_checked_out`)
- task start → `cleaning`; inspection task → `inspection`; inspection done → `ready` (`on_task_status_change`)
- `maintenance` only by manager (`confirmMaintenanceRoomClosure`); reopen goes back through `waiting_cleaning` (`reopenRoomForCleaning`)

### Refund flow (Phase 55 + 57)
1. Guest asks on a paid confirmed booking → `request_refund(uuid)`: allowed only ≥ `refund_min_days_before_checkin()` (= 2) calendar days before check-in (Bangkok), for the full total; otherwise `REFUND_TOO_LATE`. One request per booking.
2. Staff cancel uses the same rule (`cancel_booking`, Phase 57b).
3. Manager approves at `/manager/bookings?tab=refunds` → `approveRefundAction`: Stripe refund first, then `approve_refund` RPC (cancels booking + flips `payment_status`). Reject writes `refund_rejected` + emails the guest.

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

### Tests (`npm run test:unit` = pure unit tests run in CI; live-DB scripts run one by one)
```bash
npx tsx scripts/test-phase10-kpi-trend.mts       # Phase 10 KPI accuracy (live DB)
npx tsx scripts/test-phase10-refund-rpc.mts      # Phase 10 refund RPC (live DB)
npx tsx scripts/_cleanup-test-rows.mts           # Cleanup leaked test bookings
# All other test-phase*-*.mts are Phase 6–9 (live DB; mock layer deleted)
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

### Commit hygiene
- Per R2: ต้องถามก่อน `git commit` / `git push` เสมอ
- Working branch: `notmain` (default branch for PRs: `main`)

---

## 🪤 Pitfall Index

Full text with symptoms, causes and file references: **`docs/pitfalls.md`** — grep it before touching payments, refunds, bookings, housekeeping, i18n or migrations.

### Next.js 16
- `params` / `searchParams` / `cookies()` are Promises — always `await`. Pages with user data: `export const dynamic = 'force-dynamic'`.
- No `middleware.ts` (use `proxy.ts`); no `tailwind.config.ts` (tokens live in `app/globals.css @theme`).
- Never pass functions from a server component to a client component — use a client Provider + hook (`LeaveGuardProvider` pattern).
- `'use server'` files export only async functions — put schemas/helpers in a plain module (`lib/validation/*`).
- `next/link` always sets `defaultPrevented` — global click listeners must not bail on it.

### Database / migrations
- RLS: never inline `EXISTS (select … from profiles)` (42P17 recursion) — use `is_staff()` / `has_role(text)`. Every UPDATE policy needs `USING` + `WITH CHECK`.
- Add every new migration number to the regex in `scripts/run-migrations.mjs`, or it is silently skipped.
- A file in `supabase/migrations/` is not proof it ran — check `select name from _applied_migrations`.
- `scripts/run-sql.mjs` discards SELECT rows — inspect data with `pg.Client` + `pgPoolerConfig()` from `scripts/_db-connection.mjs`.
- After a migration: `NOTIFY pgrst, 'reload schema';` or PostgREST embeds fail.
- SECURITY DEFINER RPCs: allow `service_role` (`coalesce(auth.role(),'') <> 'service_role'`) and grant EXECUTE to it.
- No `FOR UPDATE` with aggregates — `PERFORM 1 … FOR UPDATE`, then a separate `count(*)`.
- text → enum needs an explicit cast (`v::payment_status`). Check live enum values before filtering (`no_show` does not exist).
- Renaming a stored key/path: update every column/array holding a copy (`gallery_keys`, `hero_slides`, …).
- Consent version: never compare `profiles.terms_version` with `PRIVACY_POLICY_VERSION` directly — use `needsConsent(session, await getCurrentConsentVersion())` (the newest `legal_versions` row wins; the constant is only the empty-table fallback).
- Check-in rooms: `available` **or** `ready` (`lib/room-status.ts`) — cleaned rooms end at `ready`; check-in flips the room to `occupied`.
- Capacity predicate (overdue unpaid rows do not occupy) must stay identical in `create_booking`, `create_temp_booking`, `has_capacity_for_booking` and `filterByAvailability`.
- `approve_refund` needs a logged-in manager (`decided_by` trigger) — tests sign in a temp manager, not service_role.

### i18n / UI
- `th.ts` and `en.ts` must mirror (same keys, same commit).
- Never `t(...) ?? fallback` — a missing key returns the key string. Never stub `t`.
- Zod messages are dictionary keys (`'validation.phone10'`), resolved by `translateZodIssues` / `localizeIssueMessage`.
- Emails use the recipient's locale: `getRecipientLocale({ userId | bookingId })`.
- A Tailwind colour token must exist as `--color-<name>` in `@theme`, or it renders no colour.
- `position: sticky` needs no `overflow-x-auto` ancestor — staff layouts' `<main>` use it (reception switched to `overflow-x-clip`).
- One-line notices: `useToast()`. `AlertModal` only for content the user must read or copy.
- Dates: compare with `toBangkokIsoDate()` / `bangkokMonthRange()`; import date helpers from `lib/dates.ts`, never local ones.

### Payments / external services
- Stripe refund first, DB flip second — never mark `refunded` before `stripe.refunds.create()` succeeds.
- Stripe webhook: `await request.text()` + `constructEvent`; no `auth.getUser()` in `/api/*`; all writes through SECURITY DEFINER RPCs.
- Stripe idempotency key must change when any param can change (time fields especially).
- Server actions accept 1 MB bodies by default — `next.config.ts` sets `serverActions.bodySizeLimit: '5mb'`; keep uploads ≤ 4 MB (Vercel ~4.5 MB cap), check size client-side, and wrap action calls in try/catch/finally.
- Browser Supabase client reads `process.env.NEXT_PUBLIC_*` by literal name — never via `lib/env.ts` on a client path.
- Realtime: `await supabase.realtime.setAuth(token)` before `.subscribe()`, or RLS hides every row.
- Never `console.log` PII (emails, phones, names, amounts).

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
| **Supabase error helpers** | `lib/errors/supabase.ts` (`wrapSupabaseError` + `actionFail` — Phase 16 + Phase 26 EN map) |
| **Shared UUID validator** | `lib/ids.ts` (`UUID_RE` + `isUuid` — Phase 16, replaces 2 duplicate defs) |
| **`sanitizeNext` helper** | `lib/auth/sanitize.ts` (relocated from `app/auth/next-utils.ts` — Phase 16) |
| **i18n infrastructure** | `lib/i18n/{config,getLocale,t,I18nProvider,useT}.ts` + `dictionaries/{th,en}.ts` (Phase 26) |
| **Language toggle** | `components/layout/LanguageToggle.tsx` (client island) + `app/actions/locale.ts:setLocaleAction` |
| **Email + R2 helpers** | `lib/email/resend.ts` (sendEmail + email_log) + `lib/r2/client.ts` (R2 SDK) + `lib/r2/publicUrl.ts` (URL builder) |
| **Email locale + formatting** | `lib/email/recipient-locale.ts:getRecipientLocale()` (guest's locale) + `lib/email/format.ts` (money/date in Asia/Bangkok) |
| **Server-action i18n** | `lib/i18n/server.ts:getServerT()` → `{ locale, t }`; Zod keys resolved by `lib/errors/translate.ts:localizeIssueMessage` |
| **Toasts** | `components/ui/Toast.tsx` (`useToast()`; provider in `app/layout.tsx`) |
| **Staff i18n checks** | `scripts/check-staff-thai.mts` (static, 0 = clean) + `scripts/test-phase27-staff-i18n-smoke.mts` (live, dev server) |
| **Refactor plan file** | `C:\Users\suns9\.claude\plans\nifty-chasing-raccoon.md` (9-commit execution log + deferred items) |
| **i18n plan file** | `C:\Users\suns9\.claude\plans\database-swirling-hoare.md` (full coverage: 6 commits + deferred items) |
| Mock data toggle | (obsolete — mock layer deleted) `lib/data/manager.ts:4` re-exports Supabase impl |
| R2 image URLs | `lib/r2/publicUrl.ts` |
| Design tokens | `app/globals.css` (`@theme {}`) |
| **i18n style token** | `bg-secondary-container`, `rounded-2xl`, `shadow-level-1/2` Tailwind v4 design tokens used by all modals |
| Migration runner | `scripts/run-migrations.mjs:53-55` (filter regex) |
| RLS helpers | `db-schemas/20260820_fix_rls_recursion.sql:7-34` |
| Refund RPC | `db-schemas/20260833_approve_refund_rpc.sql:18` |
| Cancel-booking RPC | `db-schemas/20260906_cancel_booking_rpc.sql` |
| Booking constraint | `db-schemas/20260819_bookings.sql:47` (`chk_dates`) |
| Housekeeping trigger | `db-schemas/20260821_housekeeping_tasks.sql:28` |
| **RBAC test suite** | `scripts/test-phase11-rbac.mts` (48/48 passing) |
| **RBAC fixture setup** | `scripts/_rbac-fixture.mts` (idempotent — resets test user roles + creates missing staff users) |
| **OAuth callback route** | `app/auth/callback/route.ts` (exchange code → set session cookie → redirect by role; handles BOTH OAuth and email-confirmation links) |
| **Google sign-in server action** | `app/actions/auth.ts:signInWithGoogle()` + LoginForm/RegisterForm `handleGoogle` |
| **Google OAuth provider setup** | Supabase Dashboard → Authentication → Providers → Google (toggle ON + paste OAuth Client ID/Secret จาก Google Cloud Console) |
| **Supabase email-confirmation setting** | Supabase Dashboard → Auth → Providers → Email → "Confirm email" ON |