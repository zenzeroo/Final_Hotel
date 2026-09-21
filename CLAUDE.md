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
| 29 — App-level rate limiting (Phase 20) | ✓ | `lib/rate-limit.ts` — in-memory token bucket + LRU cache (10k cap, 1h idle TTL); `checkRateLimit(ip, route)` returns `{allowed, remaining/limit}` or `{allowed: false, retryAfterSeconds, limit}`; per-route config: `/login` 10/min, `/register` 5/min, `/auth/callback` 20/min, `/api/payments/checkout` 10/min, default 60/min; `getClientIp(request)` parses `X-Forwarded-For` → `X-Real-IP` → `'unknown'`. `proxy.ts` checks all mutations (POST/PUT/PATCH/DELETE) BEFORE delegating to `updateSession`; returns 429 + `Retry-After` header + Thai message on empty bucket. `scripts/test-phase29-rate-limit.mts` — 10 smoke cases (fresh bucket, burst exhaustion, retry-after, per-IP + per-route isolation, refill timing, IP header parsing). Defense-in-depth on top of Supabase built-in auth throttle. Single-process LRU — swap to Upstash for multi-instance prod (API stays identical). Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`. |
| 31 — Excel export for manager reports (Phase 20) | ✓ | `npm i exceljs` + `app/api/manager/reports/export/route.ts` — GET handler streaming `getReportsData()` as `.xlsx` (6 sheets: สรุปภาพรวม, รายได้รายวัน, Occupancy YoY, ห้องที่ถูกจองมากที่สุด, ประเภทห้องที่มีรายได้สูงสุด, ช่องทางการจอง); bold frozen header row + per-column numFmt (`#,##0` for THB, `0.0"%"` for percent); RBAC via inline session check (manager/admin only — 401/403 otherwise). `app/manager/reports/page.tsx` "ส่งออก Excel" button changed `<button>` → `<a href="/api/manager/reports/export" download>` for native browser download. `scripts/test-phase31-xlsx-export.mts` — 10 smoke cases (ZIP signature, sheet names + counts, value round-trip, Thai UTF-8, bold + freeze styling). Closes gap where dead export button `reports/page.tsx:33-39` did nothing. Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`. |
| 19 — Multi-refund aggregation (Phase 19 #19) | ✓ | `supabase/migrations/20260911_approve_refund_aggregate.sql` — replaces `approve_refund(uuid)` + `confirm_refund_session(text,text)` SECURITY DEFINER RPCs with aggregate logic: `sum(approved_refunds) >= sum(succeeded_payments)` → `'refunded'`, else `'partial_refund'`. Locks booking row via `PERFORM 1 ... FOR UPDATE` to serialise concurrent approvals. `supabase/migrations/20260912_fix_approve_refund_service_role.sql` — fix-up mirroring cancel_booking pattern: `coalesce(auth.role(),'') <> 'service_role'` auth bypass for admin scripts + integration tests; also fixes 42804 enum cast (`text → payment_status`). `app/actions/manager.ts:127-132` — removed action-layer override block (RPC is now source of truth); kept `partialRefund` flag for Stripe call + audit row + email template (per-refund label, not per-booking aggregate). `scripts/test-phase19-multi-refund.mts` — 7 cases pass: single full, single partial, two summing to full, two summing to partial, third tipping to full, idempotency double-decision, webhook aggregation with pre-existing refund. Closes gap where multiple partial refunds on same booking clobbered `'partial_refund'` back to `'refunded'` because old RPC wrote `'refunded'` unconditionally. Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`. |
| 26 — /account profile page (Role User) | ✓ | New `app/account/profile/page.tsx` + `app/(account)/layout.tsx` + `lib/i18n/I18nProvider.tsx` + 6 client components in `components/account/` (ProfileCard, AvatarUploader, PersonalInfoForm, ChangePasswordForm, DeactivateAccountSection, AccountQuickLinks). Server actions in `app/actions/account.ts` (`updateProfileAction` / `changePasswordAction` / `deactivateAccountAction` / `uploadAvatarAction`) with R2 avatar upload + Supabase email-确认-then-soft-delete. `lib/data/supabase-account.ts` + `lib/data/account.ts` thin-re-export. `app/account/profile/page.tsx` features the 4-section profile (avatar + camera, personal info, password, danger zone) wrapped in TopNavBar/Footer with the same 2-column dashboard layout as staff pages. `accountTitle` + 12 sub-keys added to the `account` namespace in both dictionaries. `scripts/test-account-rls.mts` is out of scope (no automated test yet — visual smoke per CLAUDE.md R1). 4 commits on `origin/main` (2026-09-05). Plan: `C:\Users\suns9\.claude\plans\database-swirling-hoare.md`. **The Danger Zone / self-delete sub-feature was removed in Phase 38** — User accounts no longer expose the "ลบบัญชีผู้ใช้" button. Admin staff still controls `is_active` via `/admin/staff`. |
| 38 — Remove User-account self-delete (Phase 26 sub-feature deprecation) | ✓ | Removed the "ลบบัญชีผู้ใช้" Danger Zone section from `/account/profile` + 4 staff profile pages (which already passed `showDangerZone={false}`). **Files deleted**: `components/account/DeactivateAccountSection.tsx`. **Files edited**: `app/actions/account.ts` (removed `deactivateAccountAction` + `deactivateOwnAccount` import + `signOut` import — was only used by the removed action), `lib/data/supabase-account.ts` (removed `deactivateOwnAccount` — sole caller was the removed action), `components/account/AccountProfileContent.tsx` (removed `showDangerZone` prop + import + conditional render), `app/account/profile/page.tsx` (dropped `showDangerZone` prop), `app/{admin,manager,reception,housekeeper}/profile/page.tsx` (dropped dead `showDangerZone={false}` prop), `lib/i18n/dictionaries/{th,en}.ts` (removed 4 keys: `dangerZone`, `deleteAccount`, `deleteAccountWarning`, `deleteAccountTypeToConfirm`). **Untouched**: `profiles.is_active` column (admin `setStaffActive` still uses it), `scripts/test-deactivate-fix.mts` (records the historical Phase 26 bug fix), `signOut()` (still used by 4 nav components), `handle_new_user()` trigger + `email_log` (unrelated). **0 database changes**, 0 migrations. |
| 26 — i18n (TH/EN) full coverage | ✓ | `lib/i18n/` infrastructure: `config.ts` (Locale union, LOCALE_COOKIE), `dictionaries/th.ts`+`en.ts` (Widen<typeof th> pattern with mirrored shape, 600+ lines of localized strings across 12 namespaces), `t.ts` (getT server helper with placeholder substitution), `getLocale.ts` (precedence: cookie → profiles.locale → hotel_settings.locale_default → 'th'), `I18nProvider.tsx` + `useT.ts` (client context + hook). `setLocaleAction` server action (NEXT_LOCALE cookie + profiles.locale persistence + revalidate). `LanguageToggle` client component (2 forms, one per locale, aria-pressed). All 36 pages + 5 email templates + XLSX export headers + `lib/errors/translate.ts` threaded through `t()` or parallel maps. 12 commits on `origin/main` (2026-09-05). Plan: `C:\Users\suns9\.claude\plans\database-swirling-hoare.md`. |
| 26 — UI polish: hover transitions + a11y | ✓ | Sitewide `@media (prefers-reduced-motion: reduce)` rule in `app/globals.css` (fixes 16 spinners + 87 transitions for WCAG 2.3.3). `<Card>` component extended with `lift` prop. Hover lift applied to 5 dashboard card files. Transition-colors duration-200 + focus-visible rings on 13 admin/manager icon buttons. Chevron/arrow slide on AccountQuickLinks + homepage. Standardized tab/pill transition durations. 6 commits on `origin/main` (2026-09-05). |
| 26 — Account + booking validation | ✓ | `app/actions/account.ts:updateProfileAction` requires `bookerPhone` regex `/^[0-9]{10}$/` (was 9-10). `app/actions/booking.ts:createBookingSchema` + `app/actions/walk-in-booking.ts:walkInSchema` require `bookerPhone: regex /^[0-9]{10}$/`. `app/actions/auth.ts:signUp` already wrote to `profiles.locale`. 3 commits on `origin/main` (2026-09-05). |
| 26 — Supabase email confirmation (Register) | ✓ | `app/actions/auth.ts:signUp` detects `data.session === null` (Supabase email confirmation required) and redirects to `/register?message=check_email&next=…` with `emailRedirectTo` set to `${origin}/auth/callback?next=…`. `app/(auth)/register/page.tsx` `mapInfoMessage()` reads `?message=` and passes an `infoMessage` prop to the form (banner is rendered above the form fields). Requires Supabase Dashboard toggle: Auth → Providers → Email → Confirm email = ON. The user's `profiles.locale` is updated by the OAuth-style callback on confirmation click. Single commit on `origin/main` (2026-09-05). |
| 28 — Housekeeping assignment flow | ✓ | `supabase/migrations/20260918_housekeeping_assignment.sql` — `on_booking_checked_out()` SECURITY DEFINER trigger (auto-creates unassigned cleaning task on `bookings.status='checked_out'`, skips if `room_unit_id IS NULL` or `auth.uid() IS NULL`) + `floor_assignments` table (per-floor persisted housekeeper default with RLS staff SELECT + manager/admin write). `app/actions/housekeeping.ts` — 3 new server actions: `assignTask(taskId, housekeeperId)` (reception/manager/admin, `is_staff()` UPDATE policy covers all 4 staff per `20260823_housekeeping_rls.sql:25-36`), `createTask({roomUnitId, taskType, priority, assignedTo, notes})`, `setFloorAssignment(floor, housekeeperId|null)`. `lib/data/supabase-manager.ts` — `getHousekeepingOverview()` extended with `floor_assignments` read (persisted-first, active-task fallback) + assigned/in-progress tasks grouped by housekeeper + `housekeepers` picker list; new `listHousekeepers()` exported. `lib/data/types.ts` — `HousekeepingOverviewData` gained `housekeepers` + `assignedByHousekeeper` + new `HousekeeperOption` / `HousekeeperCard` / `AssignedTaskCard` types. UI: NEW `AssignTaskButton` (client — picker modal → confirm), `ReassignTaskButton` (wrapper with `compact=true`), `CreateTaskModal` (manager dashboard), `HousekeeperCards` (per-housekeeper task cards); MODIFIED `UnassignedTaskList` (per-row `AssignTaskButton`), `FloorAssignmentCard` (wired `setFloorAssignment` via `<select>` `onChange`), `app/manager/housekeeping/page.tsx` (header `CreateTaskModal` + `HousekeeperCards` section + `getAllRoomUnits()` parallel fetch). 25 new i18n keys under `manager.housekeepingPage` mirrored in `th.ts` + `en.ts`. `scripts/test-phase28-housekeeping-assign.mts` — 10 integration cases (auto-create on check-out, NULL skip, floor persistence + clear, housekeepers filter, assign/reassign semantics, trigger guard, anon RLS, PostgREST cache). Plan: `C:\Users\suns9\.claude\plans\role-manager-snuggly-kahn.md`. |
| 29 — Refund approval hardening + UX | ✓ | `supabase/migrations/20260919_refund_approval_hardening.sql` — four additive safety nets: (A) tightened `bookings self update` RLS `with check` to also constrain `payment_status` + explicitly deny `'refunded'`/`'partial_refund'` flip from `authenticated` role (closes Phase 28 audit Path 1 label-bypass), (B) new `refund_requests owner read` policy so users can SELECT their own refund status (required for UX badge), (C) `before_refund_request_update()` BEFORE UPDATE trigger that auto-stamps `decided_at` + `decided_by` when status flips away from `'pending'` (defensive — RPC path also sets them, but trigger catches RLS-bypass UPDATEs by manager/admin), (D) CHECK constraint `refund_rejection_requires_note` requiring non-empty `decision_note` when `status='rejected'`. `lib/data/bookings.ts` — new `getRefundStatusForBooking(bookingId, userId)` (defence-in-depth — re-queries bookings for owner check before reading refund). `lib/data/types.ts` — new `RefundRequestStatus` + `RefundStatusForBooking` types. UI: NEW `components/booking/RefundStatusBadge.tsx` (server component — 3 states: pending/approved/rejected with MaterialIcon + design-token colors); wired into `app/(booking)/bookings/[id]/page.tsx` header next to existing booking status badge. 3 new i18n keys under `bookingDetail`: `refundStatusPending`, `refundStatusApproved`, `refundStatusRejected` (mirrored TH+EN). `scripts/test-phase29-refund-hardening.mts` — 6 cases (RLS policy existence, owner-read policy, trigger function body verification, CHECK constraint deny, CHECK constraint allow, no-INSERT-policy invariant). Plan: `C:\Users\suns9\.claude\plans\role-manager-snuggly-kahn.md`. |
| 30 — Automatic Housekeeping Task Allocation (MVP) | ✓ | `supabase/migrations/20260920_housekeeping_allocation.sql` — 5 parts: (A1) `room_types.estimated_cleaning_minutes` (seed Deluxe=20m / Suite=30m / Villa=45m per user spec — `Standard` tier mapped to `Deluxe`); (A2) `housekeeping_tasks.estimated_minutes` snapshot + backfill UPDATE for pre-Phase-30 rows; (A3) widen `room_units.status` CHECK with `waiting_cleaning|inspection|ready|checkout`; (A4) rewrite `on_task_status_change` — task_type='inspection' start → room='inspection', completion → room='ready' (was 'available'), cancel → room='waiting_cleaning'; (A5) extend `on_booking_checked_out` to also UPDATE room `status='waiting_cleaning'` + INSERT task with snapshot `estimated_minutes`; (B) `v_next_checkin_per_room` view (earliest future booking per room, filtered to confirmed/checked_in with check_in >= today); (C) `allocate_housekeeping_tasks(jsonb, boolean)` SECURITY DEFINER RPC (manager/admin only, `FOR UPDATE SKIP LOCKED` on each task row + `WHERE status='unassigned'` UPDATE). `lib/algorithms/housekeeping-allocation.ts` — pure-TS LPT + Min-Load with multi-factor tiebreakers (`FLOOR_BONUS=200`, `FLOOR_CONSISTENCY_BONUS=60`, `FLOOR_DIVERSITY_PENALTY=25`). `lib/data/supabase-manager.ts` — `getHousekeepingOverview` extended with `staff_shifts` + `v_next_checkin_per_room` parallel queries; embeds `housekeeperWorkloads` + per-card `totalLoadMinutes` + `workloadPercent`. New `getHousekeeperWorkloads()` + `getNextCheckInForRooms(roomUnitIds)` standalone helpers. `lib/data/types.ts` — new `HousekeeperWorkload` type + extended `HousekeepingTask`/`AssignedTaskCard`/`HousekeepingOverviewData`. `app/actions/housekeeping.ts` — new `runAutoAllocation()` (snapshots → algorithm → RPC commit → revalidate) + `markInspected(taskId)` (manager/admin — sets task to 'completed', `on_task_status_change` trigger flips room → 'ready'). `scripts/test-phase30-housekeeping-allocation.mts` — 10 cases (algorithm unit test, floor preference, priority ordering, next-check-in urgency, RPC race condition, markInspected → ready, check-out trigger, NULL room_unit_id skip, dry-run, no available HKs). Plan: `C:\Users\suns9\.claude\plans\role-manager-snuggly-kahn.md`. **Deferred to Phase 31**: re-balance un-assigning claimed tasks, per-room-type filter, pagination, full inspection UI polish, zone mapping beyond floor. |

| 30.1 — Housekeeping polish (correctness + UX) | ✓ | `c08bacc` (2026-09-12): B1 `markInspected` gate on `task_type='inspection'` (was: any task → room flips to 'ready' skipping cleaning), B2 `totalUnassignedCount` via separate `head:true` count (RebalanceButton label no longer shows `.limit(20)` array length), B3 `buildAllocationSnapshot` capped `.limit(200)` (prevents unbounded query + huge RPC payload), B4 widen `RoomUnitStatus` type to all 9 DB values, B5 `ROOM_TO_FLOOR_STATUS` covers all 9 statuses, B8a `window.print()` wired to 'พิมพ์รายงานประจำวัน' button, U4 `PRIORITY_BONUS` in allocation score (urgent tasks gravitate to floor-aligned HK on ties), U5 empty-state tooltip on RebalanceButton (TH+EN). Test: `scripts/test-phase30-housekeeping-allocation.mts` case 11. |
| 30.2 — Housekeeper tabbed dashboard | ✓ | `6683329` (2026-09-12): 'Urgent' + 'Assigned to me' sections merged into tabbed panel `HousekeeperTasksTabs.tsx` (URL search-param driven, mirrors BookingsOversightTabs); tab badges show true counts — urgent badge '5+' overflow indicator (display array capped at 5). Data: `DashboardStats.priorityTasksCount` — true hotel-wide total via 6th parallel `head:true` query. |
| 30.3 — Housekeeping quick wins | ✓ | `d9bff21` (2026-09-12): P3 `damage_reports` query capped `.limit(50)`, B6 workload-spread warning flags HK with load=0 (floor-pref bias was hiding uneven distribution), B7 caller-side retry in `runAutoAllocation` on `task_not_found` (75/150ms backoff for transient lock states), U3 skip-reason breakdown in success modal (`race_lost: 2, task_already_assigned: 1`). |
| 31 — Housekeeper rooms page + manual status (Phase 31) | ✓ | `7c7fa58` + `68d0bf8` + `7db4806` (2026-09-16): RoomStatusCard layout-stability fix (flex flex-col + mt-auto + truncate + line-clamp-1 — mirrors RoomCard recipe); 4-option manual status dropdown (`HK_EDITABLE = ['waiting_cleaning','cleaning','ready','available']`), then **partial revert**: housekeeper can NO LONGER click to mutate room status (only DB triggers drive room status — `updateRoomStatus` role gate narrowed to `reception/manager/admin`), `ready` filter pill collapsed into `available` bucket (`FilterStatus = Exclude<RoomUnitStatus,'ready'>`). 'รายงานใหม่' button moved to dashboard header top-right (pattern mirrors `app/manager/housekeeping/page.tsx:31-52`). `RoomStatusDropdown.tsx` deleted. |
| 31 — createTask→room sync + tab badgeCap + R2 hostname (Phase 31) | ✓ | `fade7de` + migration `20260923_create_task_insert_trigger.sql` (2026-09-18): `on_task_insert()` AFTER INSERT trigger — `on_task_status_change` only fires on UPDATE OF status, so manager-created tasks left the floor grid stale. Mapping: inspection → room='inspection'; cleaning/turn_down/deep_clean/restock → 'waiting_cleaning'; guards skip occupied/maintenance/out_of_order/cleaning/inspection. `ROOM_TO_FLOOR_STATUS` collapsed (cleaning/inspection → 'dirty' — user-requested binary view: task present = สกปรก). `Tabs.tsx` gained `badgeCap` (overflow '5+' computed inside primitive — was `'5+'`, `NaN > 0` hid badge). `next.config.ts` derives `images.remotePatterns` hostname from `R2_PUBLIC_URL` (was hardcoded dev bucket). `scripts/test-phase31-create-task-sync.mts` — 11 cases pass. |
| 31 — Manual manager-controlled maintenance flow (Phase 31) | ✓ | `ccf38e3` + migration `20260922_drop_maintenance_auto_flip.sql` (2026-09-18): **drops `on_maintenance_insert()` auto-flip trigger** — critical-severity report no longer auto-closes the room (bypasses manager review). New `app/actions/maintenance.ts` (manager/admin): `confirmMaintenanceRoomClosure(reportId)` (report open→in_progress + room→maintenance, idempotent via `.eq('status','open')`) + `resolveMaintenanceReport(reportId, note?)` (in_progress→resolved + room→available, note ≤500ch). Pages `/manager/maintenance` (queue + confirm/resolve + status filter + 3 KPI tiles) + `/reception/maintenance` (read-only mirror). Components `ConfirmMaintenanceButton` + `ResolveMaintenanceButton` + sidebar nav entries. i18n keys staged under manager.maintenancePage/reception.maintenancePage/nav.maintenance. |
| 27.A — Modal primitive consolidation | ✓ | `f000a61` + `d64e5ab` `f0304f9` (2026-09-07 → 09-16): `components/ui/Modal.tsx` typed wrapper over `CenterModal` (title/body/actions contract + optional X close, focus trap + Escape + click-outside + aria-modal, `<Html>` handled). `AlertModal`/`ConfirmModal` now wrap it; 8 hand-rolled dialogs consolidated (`DeleteReviewButton`, `HideReviewButton`, `ResolveDamageButton`, `AssignTaskButton`, `CreateTaskModal`, `MaintenanceReportModal` + alerts/confirms replaced from native `alert()`/`confirm()`). 8 i18n aria-label keys in both dicts. |
| 31 — Admin room-type image delete + soft-delete | ✓ | `12bf3cf` → `a566c77` → `943d2e4` (2026-09-18): × delete affordance on thumbnails (hero + gallery) in `/admin/rates/room-types/[id]/edit`; server action `deleteRoomTypeImageAction` + new `lib/r2/delete.ts` (`DeleteObjectCommand`); **then refactored to form-submit model** — `deleteRoomTypeImageAction` deleted, deletes staged via hidden `existing_hero_key` + `delete_image_keys` JSON, applied only on 'บันทึกการแก้ไข' (opacity-40 + ring-error on pending-delete tiles + ↺ undo + 'รอลบ N รูป' banner); `updateRoomTypeAction` re-fetches DB `hero_image_key`/`gallery_keys` as **source of truth** and validates every delete key is owned by this room type (prevents crafted form deleting arbitrary R2 objects); soft-delete via new `setRoomTypeActiveAction(id, is_active)` + `DeleteRoomTypeButton` (delete/restore icon + ConfirmModal) in `RoomTypesAdminTable.tsx`; dedicated create page `app/admin/rates/room-types/new/` (+ สร้างประเภทห้องใหม่ button top-right of list header). |
| 31 — Responsive mobile pass | ✓ | `f7019a1` + `a37754b` (2026-09-18): mobile nav — `MobileOverlay.tsx` full-screen/centered overlay + `StaffMobileHeader.tsx` (hamburger) + `MobileNavMenu.tsx` (public TopNavBar), `StaffSidebar` inner content extracted to `<StaffSidebarNav userName role pathname onNavigate/>`; floor grid `FloorStatusGroup` 4→2/3/4 responsive cols + 5 tables switch `overflow-hidden`→`overflow-x-auto` (scroll lives inside rounded card). |
| 32 — Admin room-types tabbed view (3 states) | ✓ | `/admin/rates/room-types?tab=active\|inactive\|deleted` (default `active`); `20260924_room_types_soft_delete.sql` adds `room_types.deleted_at timestamptz NULL` + `idx_room_types_deleted_at` + tightens public RLS to `is_active=true AND deleted_at IS NULL`; `20260925_drop_stale_room_types_policy.sql` drops the legacy `"public read room_types"` policy that survived from migration `20260819_room_types_rls.sql:15` (the v2 `"room_types public read"` in `20260828_phase7_admin_foundation.sql:194` was created under a different name without dropping the original — both coexisted and OR-logic defeated the new USING clause until the stale one was dropped). `lib/data/types.ts:RoomType.deleted_at: string \| null`; `lib/data/supabase-rooms.ts:listRoomTypes(filter?)` — new optional `{isActive?: boolean \| null, isDeleted?: boolean \| null}` filter shape + `.is('deleted_at', null)` defense-in-depth in `getFeaturedRooms`, `getRoomBySlug`, `searchRooms`, `getRoomTypes`, `getFloors`. `app/actions/admin/rates.ts` — `setRoomTypeActiveAction` extended with optional `deleted_at` field; new `restoreRoomTypeAction`; new `permanentlyDeleteRoomTypeAction` (hard DELETE with SQLSTATE 23503 → TH error, best-effort R2 cleanup of hero+gallery). `app/admin/rates/room-types/page.tsx` — 3 tabs (active/inactive/deleted) with badge counts via 3 parallel `listRoomTypes(filter)` calls; per-tab subtitle + section title. `components/admin/RoomTypesAdminTable.tsx` rewritten with 3 sub-components (`ActiveRowActions`/edit+deactivate, `InactiveRowActions`/edit+reactivate+soft-delete→deleted, `DeletedRowActions`/restore+permanent-delete) + per-tab empty-state copy. i18n skipped (Phase 26 deferral — admin sub-pages remain TH-only). Test: `scripts/test-phase32-room-types-tabs.mts` — 8 cases pass (column shape, filter partitioning, anon RLS exclusion, admin read-through, restore round-trip, hard-delete on empty room, FK violation, cleanup). |
| 33 — Admin staff AddStaffModal pop-up | ✓ | `/admin/staff`: replaces inline `<AddStaffForm />` section with "เพิ่มพนักงาน" trigger button in header top-right (next to N คน badge). NEW `components/admin/AddStaffModal.tsx` wraps the same form fields inside `<Modal>` primitive + 4 file-local sub-components (`SuccessState`/`ErrorBanner`/`FormGrid`/`FormActions`). Modal behavior: success → keep open, show generated password + "เสร็จสิ้น" button; error → keep open with inline banner; pending → `closeOnBackdrop={!isPending}` blocks backdrop close mid-submit; close → 200ms delayed state reset prevents flicker. DELETE `components/admin/AddStaffForm.tsx` (sole caller replaced). No server-action changes — `createStaffAction` still calls `revalidatePath('/admin/staff')` for table auto-refresh. No i18n threading (matches Phase 26 deferral — admin sub-pages remain TH-only). |
| 33.1 — StaffSidebar: render uploaded avatar + Tier 3 hover polish | ✓ | Commit `43c0980` + `e2c8b7d`: NEW `components/account/AvatarBadge.tsx` (read-only avatar + initials fallback) replaces `<MaterialIcon name="account_circle">` in staff sidebar profile link. 4 layouts (admin/manager/reception/housekeeper) pass `avatarKey={session.avatarKey}` from `getSession()`. Tier 3 polish (slide + chevron + border-l accent + icon weight via MaterialIcon's new `--icon-fill` CSS var + sheen sweep) applied to nav items + profile + logout buttons. No schema changes. |
| 34 — Staff profiles: apply User profile pattern | ✓ | Commit `1415c86`: NEW `/{role}/profile` (admin/manager/reception/housekeeper) — same 4-card composition as User `/account/profile`. Refactored `PersonalInfoForm`/`AccountProfileContent`/`AccountQuickLinks` to be role-aware. 4 staff pages pass role-aware props; admin can self-edit own profile (gets own role's page). Added 3 fields to `AccountProfile`: avatar display in sidebar (Phase 34.5). Staff profile link added to `<StaffSidebar>` user section. |
| 34.5 — Sidebar avatar in profile link + Profile UX polish | ✓ | Commit `43c0980` (AvatarBadge component, see Phase 33.1) + commit `90c6b43` (revalidatePath covers all 5 staff profile routes — was missing /admin|manager|reception|housekeeper/profile, causing "save says success but page stays stale") + commit `7068199` (name + birthdate locked for staff roles — UI shows locked fields with hint "ข้อมูลส่วนบุคคลที่ยืนยันตัวตนแล้ว หากต้องการเปลี่ยนกรุณาติดต่อผู้ดูแลระบบ", server Zod branches — User keeps full edit). Commit `6c32cba`: ChangePasswordForm placeholders now descriptive Thai ("กรอกรหัสผ่านปัจจุบัน" / "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)" / "พิมพ์รหัสผ่านใหม่อีกครั้ง"). Commit `6e0f88b`: fixed `profiles admin write` RLS recursion (per CLAUDE.md zenzero-rls-recursion-fix — inline EXISTS-on-profiles triggers 42P17, replaced with `has_role()` SECURITY DEFINER helper). Loosened `updateProfileSchema.phone` regex from `/^[0-9]{10}$/` to `/^(|0{10}|[0-9]{10})$/` (allows empty + sentinel). |
| 36 — Admin customer management + suspension enforcement | ✓ | Commit `7813f02`: NEW `/admin/customers` (admin-only — layout gate + server-action `requireRole('admin')` + sidebar item only in admin's `NAV_BY_ROLE`). Migration `20260928_customer_suspension.sql` adds `profiles.is_suspended`/`suspended_at`/`suspended_reason` + index; makes `booking_events.booking_id` nullable (previously required for all audit rows). 5 NEW data-layer functions: `listCustomers` (URL-driven search/filter via `.or()` + `.eq()`), `getCustomerById`, `getCustomerBookingCount` (parallel per-page count), `suspendCustomer`/`unsuspendCustomer`. NEW server actions `suspendCustomerAction`/`unsuspendCustomerAction` (requireRole admin, self-protection, booking_events audit with booking_id=null). NEW routes: `/admin/customers` (list page w/ KPI tiles + search/status filter), `/admin/customers/[id]` (detail page w/ profile + booking history + suspend button). NEW components: `CustomersAdminTable`, `SuspendCustomerButton` (Modal w/ reason textarea), `UnsuspendCustomerButton` (ConfirmModal). App-layer enforcement per CLAUDE.md zenzero-rls-recursion-fix: `lib/supabase/getSession.ts` checks `is_suspended` after auth → signOut + redirect `/login?error=suspended`; `app/actions/booking.ts:createBookingAction` rejects suspended customers. Sidebar adds "ลูกค้า" item between Dashboard + Promotions (admin-only). i18n: `admin.sidebar.customers` + `admin.customersPage.*` namespace (mirror enforced by `Widen<typeof th>`). 4 roles never see the item (their NAV_BY_ROLE arrays unchanged); direct URL blocked by `app/admin/layout.tsx:11`. |
| 36.1 — Fix Google OAuth profile.email bug (hotfix) | ✓ | Commit `f039e6d`: Migration `20260929_fix_handle_new_user_email.sql` restores `email` + `hired_at` columns to `handle_new_user()` trigger INSERT (lost in `20260913_require_phone.sql:63-80` rewrite) + backfills NULL rows from auth.users. Verified post-apply: 0 missing_email, 0 mismatched_email across 19 profiles (incl. Google OAuth users `notnannam12@gmail.com` + `arhat4148@gmail.com` + `6610122115032@pnru.ac.th`). **Always re-run a full backfill + sanity-check after any `CREATE OR REPLACE FUNCTION public.handle_new_user()` (or other auth-related trigger)** — `select count(*) filter (where p.email is null) as missing, count(*) filter (where p.email is distinct from au.email) as mismatched` should return 0,0 after backfill. Fix: `20260929_fix_handle_new_user_email.sql` restores the columns + backfills NULL rows. |
| 37 — Identity linking (email/password + Google in one account) | ✓ | User can sign in via BOTH email/password AND Google OAuth on the same account. NEW `supabase/migrations/20261001_identity_linking_helpers.sql` adds `public.can_link_identity_by_email(text, boolean)` SECURITY DEFINER helper — defense-in-depth gate that requires email_verified=true on BOTH sides before allowing any merge. Returns `(safe_to_link, existing_user_id, existing_email_verified, reason)` so callers can render localized errors (`new_email_unverified` / `existing_email_unverified` / `verified_both_sides` / `no_existing_account`). 5 NEW data-layer functions in `lib/data/supabase-account.ts`: `listMyIdentities` (DTO over `auth.getUserIdentities()`), `hasPasswordIdentity` (for ChangePassword vs SetPassword branching), `checkIdentityLinkSafety` (calls the SQL helper via RPC), `getGoogleLinkUrl` (wraps `supabase.auth.linkIdentity({provider:'google', skipBrowserRedirect:true})`), `setPasswordViaAdmin` (`auth.admin.updateUserById({password})` — no current-password required because admin is privileged). NEW `app/actions/identity-link.ts` with 5 server actions: `getMyLinkedIdentities`, `getHasPasswordIdentity`, `startLinkGoogleIdentityAction` (validates safety → calls linkIdentity → `redirect(url)` to Google consent), `setPasswordForOAuthOnlyAction` (refuses if already has password), `unlinkIdentityAction` (refuses if would leave ≤1 identity). `/auth/callback/route.ts` learns `?intent=link` branch — always redirects to `/account/profile?linked=google` (skips role-home routing for linking flow). UI: NEW `components/account/LinkedAccountsCard.tsx` ("วิธีเข้าสู่ระบบ" card on /account/profile — lists email-password + Google rows + "Add a sign-in method" connect buttons + flash banner from `?linked=google` / `?link_error=cancelled`), `AccountSecuritySection.tsx` (branches ChangePassword vs SetPassword based on `hasPasswordIdentity()` — fixes the bug where ChangePasswordForm always required current password even for Google-only accounts), `ConnectGoogleButton.tsx`, `SetPasswordForm.tsx`, `UnlinkIdentityButton.tsx` (with confirm modal). i18n: 15 new keys in `profile.*` namespace mirrored TH+EN (`loginMethods`, `connectGoogle`, `setPassword`, etc.). Tests: `scripts/probe-identity-link.mts` documented current collision behavior (service-role createUser with dup email → 422 `email_exists`; anon signUp with dup email → succeeds with anonymous identity until confirmation); `scripts/test-phase37-identity-linking.mts` — 5/5 pass (SQL helper verified-both-sides path; SQL helper new-email-unverified rejection; listMyIdentities shape; admin-set password round-trip; server-side "Manual linking is disabled" on unlink — proves Dashboard toggle is the runtime gate). **Dashboard prerequisite**: Supabase Auth → Providers → "Allow manual linking" / "Enable Manual Linking" toggle MUST be ON for `linkIdentity()` + `unlinkIdentity()` to work — verified by case 5 of the test which still gets "Manual linking is disabled" from the auth server. Without toggle ON: signInWithOAuth returns 422 "User already registered" on collision; linkIdentity/unlinkIdentity reject. SQL helper is defense-in-depth regardless. |


**Current HEAD**: working tree — Phase 38 (Remove User-account self-delete, Danger Zone removed from /account/profile + 4 staff profiles) on top of Phase 37 (identity linking) + Phase 36 (admin customers) + Phase 36.1 (OAuth email hotfix) + Phase 34.5/34.6. 7 phase rows added to status table above. No new DB schema changes; only the User-side self-delete code path was removed (admin `setStaffActive` still flips `is_active`). **Dashboard prerequisite for Phase 37**: Supabase Auth → Providers → "Allow manual linking" toggle MUST be ON — without it, `linkIdentity()` / `unlinkIdentity()` server-side reject with "Manual linking is disabled". Verified by `scripts/test-phase37-identity-linking.mts` Case 5.

---

## 🔭 Open Items / Where to pick up next

**Phase 38 done — what's pending:**

| Priority | Item | Where to look |
|---|---|---|
| 🔴 Verify | **Dashboard "Allow manual linking" toggle = ON** — required for Phase 37 runtime. Run `npx tsx scripts/test-phase37-identity-linking.mts`; Case 5 should no longer return `"Manual linking is disabled"` | `docs/PROJECT-STATUS.md` § "Dashboard toggles REQUIRED" |
| 🟠 Open | **Phase 27 backlog A-H** — 27.A Modal primitive ✅ done. Remaining: 27.B Toast/snackbar, 27.C server-action `locale` threading, 27.D 4 email templates i18n, 27.E staff dashboard sub-pages i18n, 27.F `AccountQuickLinks` dead links, 27.G locale cookie on sign-out, 27.H alert() → toast | `## 🔭 Future Work / Backlog` below |
| 🟡 Open | **Phase 39+ candidates** — PDF generation (D1 PDFKit already decided in `docs/phase31-decisions.md`), 2FA/GDPR cookie consent, staff_shifts write UI, notification system (gap #26), loyalty/user-promotions features | `docs/phases-upcoming.md` |
| ✅ Done | Phase 37 (identity linking), Phase 38 (User self-delete removed) | See status table above |
| 🔵 Maintenance | `git push origin notmain` — 6 commits (b9860aa + 9cb5376) on local `notmain` not yet on remote | Ask before push (R2) |

**Quick pointers for AI sessions:**
- Need to onboard fast? Read `docs/PROJECT-STATUS.md` first (~150 lines).
- Need full phase history? Read `docs/phases-done.md`.
- Need phase decisions + plans? Look in `C:\Users\suns9\.claude\plans\` (LOCAL, not in repo).
- Stuck on a pattern? Grep this file's `## Common Pitfalls` section — most gotchas are documented.

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

**Node version requirement**: ไม่ pin ใน `package.json` — แนะนำ Node ≥ 20.x (Next.js 16 minimum) [ต้องยืนยัน]

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
Mock layer deleted. Every `lib/data/<domain>.ts` is a thin re-export from `supabase-<domain>.ts`. To debug a function, go straight to the Supabase impl. The catalog of amenity slugs that `AmenityGrid` renders lives in `lib/data/supabase-rooms.ts:getApprovedAmenities` (was `data/mock-amenities.json`).

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
| `booking_status` | pending, confirmed, checked_in, checked_out, cancelled | `20260819_bookings.sql:8` |
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
| `create_booking(uuid,uuid,date,date,...)` | `(uuid, uuid, date, date, ...) RETURNS bookings` | **Phase 20 #23** — overbooking prevention: `FOR UPDATE` lock on room_units pool + overlap count under `daterange &&` (see Common Pitfalls) |
| `cancel_booking(uuid, boolean, numeric)` | `(uuid, boolean, numeric) RETURNS TABLE(...)` | **Phase 20 #24** — cancellation policy enforcement: locks booking, computes refund via `free_cancel_hours`/`refund_pct`, flips status, inserts refund_requests + audit row (see Common Pitfalls) |
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

- **`listRoomTypes().map(rt => rt.type)` can duplicate React keys when DB has multiple room_types rows with the same `type` enum value** — checkbox list in `PromotionForm` uses `key={type}` (line 227); if the table has e.g. two `'Deluxe'` entities (A/B testing, multiple room configs), the resulting array has duplicates and React logs `Encountered two children with the same key, 'Deluxe'`. Fix: use `getRoomTypes()` (dedupes via `new Set` ใน `lib/data/supabase-rooms.ts:203`) for the names array. Use `listRoomTypes()` only when you need full `RoomType[]` objects (e.g. `<select>` keyed by `rt.id` ใน `SeasonalRateForm`). เคยเกิดตอน refactor seasonal-rates tab เข้า `/admin/promotions/new?tab=code` (commit `f306ae2`) — Phase 27 lesson

- **Overbooking at booking insert (Phase 19 fix)** — ก่อน Phase 19, `createBooking` แค่ validate `is_active + max_guests` (`app/actions/booking.ts:138-165`) — ไม่เช็ค physical inventory สำหรับช่วงวันที่เลือก. Two web bookings for same `room_type_id` + overlapping dates both succeed at DB level; conflict surfaces ตอน reception check-in เท่านั้น. Fix: `create_booking(...)` SECURITY DEFINER RPC (`db-schemas/20260904_create_booking_rpc_and_constraint.sql`) locks the room_units pool under `PERFORM 1 ... FOR UPDATE` (NOT `SELECT count(*) ... FOR UPDATE` — see below), counts slot-occupying bookings (`status IN ('confirmed','checked_in')`) overlapping the date range via `daterange && daterange`, throws P0001 when `count >= pool_size`. Defense-in-depth EXCLUDE constraint `bookings_no_unit_overlap` fires at check-in when `room_unit_id` is assigned. RPC grants EXECUTE to `authenticated` + `service_role` — auth check is the server action's responsibility. Walking-in flow (`walk-in-booking.ts`) now inserts booking via admin.rpc() then flips `payment_status='paid'` + records `payments` row in a follow-up step (RPC always writes 'unpaid'). Reference: `scripts/test-phase20-overbooking.mts` (7 tests pass covering single insert, non-overlapping, overlapping rejection, cancel+rebook, 5-way concurrent, walk-in-vs-web, EXCLUDE constraint)

- **`FOR UPDATE` is not allowed with aggregate functions (Phase 19 #23 pitfall)** — Postgres rejects `SELECT count(*) FROM t WHERE ... FOR UPDATE` with SQLSTATE 0A000 ("FOR UPDATE is not allowed with aggregate functions"). To lock rows + count in the same transaction: do `PERFORM 1 FROM t WHERE ... FOR UPDATE` first (acquires the row locks), then a separate non-locking `SELECT count(*) FROM t WHERE ...` in the same plpgsql function body — safe because the row locks serialise concurrent critical sections for the matching rows. Shipped buggy in `20260904_create_booking_rpc_and_constraint.sql`; fixed in `20260905_fix_create_booking_lock.sql` (drops + recreates the function). Caught by the 7-case integration test on first run — all 7 cases failed with SQLSTATE 0A000 until the fix migration applied. When writing any future RPC that needs atomic count-under-lock, use the PERFORM-then-COUNT pattern (or `pg_advisory_xact_lock(key)` for named locks). Reference: `app/actions/booking.ts:138-178` + `walk-in-booking.ts:157-239` are now backed by this pattern

- **`scripts/run-sql.mjs` silently discards SELECT row results** — calls `client.query(sql)` once and only logs "Success"/"Failed" — it does NOT iterate rows or print them. Pre-flight SELECT queries via `run-sql.mjs` give a false-negative "empty result" signal that masks real data. For SELECT inspection (e.g. "find duplicate phones before adding UNIQUE constraint"), use a one-off script with `dotenv` + direct `pg.Client` + iterate `client.query(...).rows`, or use `npx tsx <script>.mts` with `createAdminClient()` from `@/lib/supabase/admin` (loads `.env.local` via the normal Next.js path). Hit during Phase 27 staff-create: pre-flight via `run-sql.mjs` reported empty but the migration's own `RAISE EXCEPTION '... % duplicate ...'` (which runs via direct SSL `run-migrations.mjs`) caught 11 rows sharing sentinel `'0000000000'` from the 20260913 backfill. Fix: backfill dup sentinels to unique placeholders (`'1000000000'`..`'1000000009'`) before retrying UNIQUE migration. Pattern mirrors the existing `run-sql.mjs` line: "for DDL/DML — SELECT results discarded". Reference: `scripts/run-migrations.mjs:30` (just `await client.query(sql)` + `Success` log) vs `scripts/.tmp_dup.mjs` (iterates `res.rows` directly via direct `pg.Client`)

- **Cancellation policy bypassed (Phase 20 #24 fix)** — ก่อน Phase 24, `cancelBooking` (`app/actions/booking.ts:183-201`) แค่ `UPDATE bookings SET status='cancelled'` โดยไม่เช็ค `cancellation_policy` เลย — guest กดยกเลิกตอนไหนก็ได้ 100% refund ทั้งหมด แม้กระทั่ง 5 นาทีก่อนเช็คอินบน Strict policy (168h free window / 0% refund) = contract violation. Fix: `cancel_booking(uuid, boolean, numeric)` SECURITY DEFINER RPC (`db-schemas/20260906_cancel_booking_rpc.sql`) — locks booking `FOR UPDATE`, validates `status='confirmed'`, looks up policy (or default fallback), computes `refund_amount = total * refund_pct/100` based on hours-until-checkin vs `free_cancel_hours` (or staff override), flips status, inserts `refund_requests` row only when `payment_status='paid' AND refund_amount > 0` (manager reviews + approves via existing Phase 10/18 path), inserts `booking_events` audit with full policy metadata. RPC returns typed TABLE so UI can show "จะได้รับเงินคืน X / เสียค่าธรรมเนียม Y ตามนโยบาย <name>". Two follow-up pitfalls caught + fixed in `20260907_fix_cancel_booking_auth.sql`: (1) `auth.uid() IS NULL` blocked service_role callers (admin scripts, walk-in tooling, the integration test itself) — fix uses `coalesce(auth.role(),'') <> 'service_role'` to bypass auth gate; (2) `actor_role` insert cast needed explicit `::user_role` because the column is enum not text. Reference: `app/actions/booking.ts` (cancelBooking + cancelBookingByStaff) + `scripts/test-phase24-cancel-policy.mts` (7 tests pass)

- **NOT NULL + CHECK migration backfill must cover bad-format rows, not just NULLs (Phase 27 lesson)** — เขียน migration `20260913_require_phone.sql` แรก `update ... where phone is null` — fail ที่ CHECK constraint เพราะ live DB มี rows ที่ `phone IS NOT NULL` แต่ format ไม่ตรง regex (เช่น legacy test data `'081-111-1111'` มีขีด, Thai keyboard mash `'ฟหกหฟกฟก'`). Fix: `update ... where phone is null or phone !~ '^[0-9]{10}$'` — ครอบคลุมทั้ง NULL และ non-conforming rows. หลักการ: ก่อนเพิ่ม CHECK constraint + NOT NULL, **pre-flight query** หา distribution ของ values ปัจจุบันเสมอ (run dry-run SELECT count/format breakdown) — ถ้า legacy data มี format variants ที่ไม่ตรง regex, backfill WHERE clause ต้องครอบทั้งหมด. ใช้ได้กับ migrations อื่นๆ ที่ enforce format constraint (เช่น email regex, tax_id format) — ตรวจ `information_schema.columns` + sample bad values ก่อน ALTER เสมอ. Reference: `supabase/migrations/20260913_require_phone.sql` + temp `scripts/.tmp_check_phone.mjs` (deleted after verify)

- **email_log.booking_id uses ON DELETE SET NULL, not CASCADE (Phase 20 #25)** — `20260908_email_log.sql` declared FKs as `references public.bookings(id) on delete set null` (same for `payments.id` + `refund_requests.id`) — the email audit row survives a booking deletion with its FK column set to NULL, NOT row deletion. Rationale: even if a booking is hard-deleted (test cleanup, accidental admin delete), the email history ("we sent X template to Y address on Z date") is preserved for compliance / replay / debugging. When writing FK cleanup tests: assert `afterRows.length === 1` (row exists) + `afterRows[0].booking_id === null` (FK cleared), NOT that the row was cascade-deleted. Phase 25 caught this in `scripts/test-phase25-email.mts` Case 7 — first version of the test expected the row to vanish with the booking, got `null` count after `head:true` query, fixed to verify ON DELETE SET NULL semantics

- **Client-side supabase mutation can't fire emails (Phase 20 #25 fix)** — `CheckInOutActions.tsx` ตอนแรกทำ `supabase.from('bookings').update({status: 'checked_out'})` ตรงจาก client component (RLS allowed it). Phase 25 ต้อง fire `checkout_thank_you` email หลัง status flip — แต่ Resend API key + admin client (สำหรับ email_log RLS-bypass insert) ทำงานได้เฉพาะ server-side. Fix: สร้าง `app/actions/check-in-out.ts` มี `checkInBookingAction` + `checkOutBookingAction`, refactor component จาก inline supabase update เป็น `await checkOutBookingAction({bookingId})` + `router.refresh()` — server action holds `requireRole()` gate + DB update + email fire-and-forget + audit row ในที่เดียว. หลักการเดียวกันใช้กับ client-side mutation อื่นๆ ที่ต้องการ send email / write to RLS-blocked table / call Resend — ถ้าต้องเพิ่ม email template ให้ mutation ที่เคยทำ client-side, ย้ายมันไป server action ก่อน. Reference: `app/actions/check-in-out.ts:1` + `app/reception/check-in-out/CheckInOutActions.tsx:38-62` (server action call replaces supabase update)

- **Never console.log PII in production (Phase 20 #25 find)** — `lib/email/resend.ts` dev-fallback path originally `console.log`'d the recipient email + subject + full rendered body when `RESEND_API_KEY` was missing. Even though the fallback only fires when Resend is unconfigured, a production deploy with a missing env var would leak guest PII (email addresses) + email body content into stdout / log aggregation. Fix: wrap body logging behind `NODE_ENV !== 'production' && EMAIL_LOG_BODY === '1'` (opt-in), always redact the recipient via `redactEmail()` (e.g. `te***@zenzero.com`), keep the summary line (template + event_key) PII-free. Same rule applies to ANY `console.log` that touches recipient email, phone, name, payment amount, or booking contents. The `email_log` row already records who got what — console.log should only carry diagnostic metadata, never PII. Reference: `lib/email/resend.ts:108-135` (dev-fallback log block)

- **Migration runner skip-on-rerun** — `scripts/run-migrations.mjs:60` regex filters files by number AND tracks applied names in `_applied_migrations`. Re-applying a migration = no-op (not an error). To FORCE a re-apply (e.g. fix-up to a shipped function), the canonical pattern is a new migration file (`20260907_*`) that does `drop function if exists ...` + `create or replace function ...` — NOT a manual drop on the live DB. Caught during Phase 24: first apply of `20260906` was buggy, second attempt was a silent skip; fix was `20260907_fix_cancel_booking_auth.sql` (counted in regex + carries the full body). When iterating on a freshly-shipped RPC, prefer the fix-up migration path

- **listStub pitfall** — historically: wiring the dispatcher (`lib/data/manager.ts`) wasn't enough — had to also check `lib/data/supabase-*.ts` for `return []` stubs. With the mock layer deleted, the dispatcher is now a thin re-export, so the real impl is the only impl. Still relevant: when adding a new function, write the Supabase implementation directly (the wrapper will re-export it).

- **Next.js 16 server action HTTP test** — POST server action ผ่าน HTTP ต้องใช้ field `$ACTION_ID_<id>` ใน multipart body (ไม่ใช่ `Next-Action` header เหมือนเวอร์ชั่นก่อน). Reference: `scripts/test-phase10-refund-rpc.mts:106-114`

- **SSR HTML comment split** — React SSR แทรก HTML comment ระหว่าง text nodes, e.g. `+<!-- -->12.5<!-- -->%` — regex parse ตัวเลขต้อง `.replace(/<!--[^>]*-->/g, '')` ก่อน. Reference: `scripts/test-phase10-kpi-trend.mts:115-116`

- **Admin RLS blocks DELETE on bookings** — admin มีแค่ UPDATE grant (staff policy), ไม่มี DELETE → cleanup test rows ด้วย admin client silent fail. ใช้ `createServiceClient(BASE, SUPABASE_SERVICE_ROLE_KEY)` แทนสำหรับ DELETE step

- **`scripts/` excluded from project tsconfig** — `npm run typecheck` ไม่เช็ค scripts. ต้องใช้ `npx tsx` รัน (type-strip อัตโนมัติ)

- **Hardcoded Supabase pooler region** — Phase 12 ย้าย region ไปอ่านจาก `scripts/_db-connection.mjs` (default `aws-0-ap-southeast-1.pooler.supabase.com`) ผ่าน env var `SUPABASE_POOLER_HOST`. Scripts ที่ใช้ shared helper: `promote-manager`, `query-manager-id`, `check-enum`, `check-target`, `run-add-manager-enum`, `run-sql`. `check-cols.mjs` ใช้ `pgDirectConnectionString()` กับ direct host. ย้าย region = แก้ env var เดียว

- **Hardcoded manager UID** ใน `scripts/promote-manager.mjs` — Phase 12 รองรับ `MANAGER_ID` env var (direct) หรือ `MANAGER_EMAIL` env var (resolve ผ่าน `auth.users` lookup). ถ้าไม่ตั้งค่าเลย จะ fall back ไปใช้ legacy literal `ba4b825d-3dec-4db0-b604-82f20c8cb165`

- ~~**`getRoomTypes` + `getFloors` ใช้ mock เสมอ**~~ — fixed: now `SELECT DISTINCT type/floor FROM room_types WHERE is_active = true` in `lib/data/supabase-rooms.ts:130,142`

- **RBAC redirect target (Phase 11 fix)** — `redirect('/')` ใน wrong-role guard ทำให้ staff ตกไปที่ User homepage แล้ว browse User pages ได้. ทุก wrong-role redirect ต้องใช้ `roleHomePath(session.role)` จาก `lib/supabase/getSession.ts` เสมอ — admin → `/admin`, manager → `/manager`, reception → `/reception`, housekeeper → `/housekeeper`, user → `/`. ใช้แล้วใน: `proxy.ts:72-93,99-104`, 4 staff portal layouts, 10 `requireXxx` helpers ใน `app/actions/*`, `(booking)/layout.tsx` (User-only gate). เพิ่ม role ใหม่หรือหน้าใหม่ต้อง update `roleHomePath()` + เพิ่ม route ใน proxy.ts `staffPaths` (หรือสร้าง role-specific layout).

- **Migration runner regex** — `scripts/run-migrations.mjs:54` มี alternation literal ของหมายเลข migration ที่อนุญาต (`/202608(27|29|30|31|32|33|34)_.*\.sql$/`). Migration ใหม่ที่หมายเลขอยู่นอก alternation จะถูก silently skip — `node scripts/run-migrations.mjs` exit 0 แต่ไม่ apply อะไร. ต้องเพิ่มหมายเลขใน regex ก่อนสร้างไฟล์ migration ใหม่เสมอ

- **i18n dictionary mirror shape (Phase 26 lesson)** — `lib/i18n/dictionaries/en.ts` must mirror `th.ts` exactly. The structural type is `Widen<typeof th>` so adding a NEW key to `th.ts` without the matching `en.ts` entry surfaces a `Widen<...>`-related TS error at typecheck. **Pattern A (good):** both files use `as const` + identical namespacing — typecheck catches drift. **Pattern B (avoid):** `Record<string, string>` lets the EN dict silently miss keys. The `t()` helper falls back to the key string itself (`namespace.key`) when a key is missing in the active locale, so missing EN keys would render `home.heroTitle` literally in the UI — dev-friendly, but a real i18n hole. Always update BOTH dicts in the same commit.

- **Widen<typeof th> vs DeepJoin (Phase 26 gotcha)** — `Widen<T>` recursively widens string literals to `string`, but the `DeepJoin` helper that walks the type must use the same param count as the call site. If you see `TS2314: Generic type 'DeepJoin' requires 2 type argument(s)`, check that `export type TKey = DeepJoin<Widen<typeof th>, ''>` (2 args) matches `type DeepJoin<T, Prefix extends string>` (2 params). Adding a 3rd unused param (e.g. `_Path: string[]`) breaks the call site until you remove it.

- **`useT()` requires `<I18nProvider>` (Phase 26)** — any client component calling `useT()` must be inside an `<I18nProvider locale={…}>` in the React tree. Currently `app/layout.tsx` mounts the provider at the root with locale from `getLocale()`. If a future client component throws `useT() must be used inside <I18nProvider>`, it means the provider is missing from its parent chain (likely a new client-only layout that bypasses `app/layout.tsx`).

- **`mapInfoMessage` was a dead-code trap (Phase 26 lesson)** — `app/(auth)/register/page.tsx:mapInfoMessage` was wired end-to-end (the `?message=check_email` URL param → `infoMessage` prop → banner in `RegisterForm.tsx`) but the `case 'check_email'` branch returned `undefined`. The form's banner block was dead code. Always verify end-to-end flows: the path from URL param to UI render. If a user-facing function is hooked up but always returns a falsy value, the symptom is silent (no crash, just a missing affordance). Fixed in `18c403d` — now returns the literal string `'check_email'` so the banner actually shows.

- **`prefer-reduced-motion` is one global rule (Phase 26 commit `2a6492d`)** — a single `@media` block in `app/globals.css` covers every `transition-*` and `animate-spin` sitewide because Tailwind utilities are CSS classes. Future contributors adding new transitions do NOT need to remember to add the reduced-motion guard. If you need opt-out (e.g. for an essential loading indicator), wrap that specific element in a CSS module that overrides the rule (`@media (prefers-reduced-motion: reduce) { .my-loader { animation: none; } }`).

- **Locale precedence is cookie → profile → hotel (Phase 26)** — `getLocale()` precedence: 1) `NEXT_LOCALE` cookie (set by `setLocaleAction`), 2) `profiles.locale` (authed user), 3) `hotel_settings.locale_default` (admin-configured), 4) `'th'` fallback. If a user switches language and the cookie is set, the cookie wins for 1 year — even after sign-out. To "forget" the preference, sign-out should also `cookieStore.delete(LOCALE_COOKIE)`. Currently we don't, so an anonymous user on a shared device keeps the last user's preference.

- **XLSX column headers + sheet names come from inline EN/TH maps, NOT from the dictionary (Phase 26 commit `2663118`)** — `app/api/manager/reports/export/route.ts` keeps its own `XLSX_LABELS: Record<Locale, Record<string, string>>` map because ExcelJS column objects are server-side data, not React tree nodes that `t()` can read. If you add a new column/sheet, update BOTH the TH and EN branches of that map in the same commit.

- **Dead `#` placeholder links in `components/account/AccountQuickLinks.tsx`** — the 'favorite rooms' and 'my promotions' items render as `<a href="#">`. They have full hover/click affordance but do nothing. UX-confusing. Either remove them (with a TODO comment) or stub the routes. Currently both items remain placeholders awaiting Phase 27 (loyalty + user-promotions features per the Phase 20 #20 backlog).

- **Staff dashboard sub-pages still mostly Thai (Phase 26 deferred)** — `app/manager/{bookings,housekeeping,reports,reviews,settings,staff,promotions,rates}/page.tsx` + 8 reception sub-pages + 4 housekeeper sub-pages + 5 admin sub-pages are still Thai-only. The 4 main dashboards (manager/reception/housekeeper/admin root pages) are localized but most detail/sub-pages aren't. Recipe from Phase 26 commit 4 applies — pass `getLocale()` + `t()` to each page and swap literals. This is a follow-up batch; estimated 30-50 more commits of mechanical class additions.

- **Email templates (4 of 5) not yet locale-aware (Phase 26 commit `2663118` only touched `booking-confirmation`)** — `lib/email/templates/payment-receipt.tsx`, `cancellation-notice.tsx`, `refund-notice.tsx`, `checkout-thank-you.tsx` still hardcode Thai. Same recipe: add `locale?: Locale` prop, EN/TH `Strings` map per template, `<Html lang={LOCALE_BCP47[locale]}>`, formatted currency. Server actions that call `sendEmail()` need to read locale from cookie and pass it in. Same `email.*` dictionary keys already exist in the `en.ts` mirror.

- **Server actions in `app/actions/{booking,walk-in-booking,account}` still pass Thai fallback only (Phase 26 deferred)** — `signIn` was localized (commit `2bf4e31`); `signUp` + `updateProfileAction` + `changePasswordAction` + `deactivateAccountAction` + `uploadAvatarAction` still use hardcoded Thai strings for inline validation. Recipe: read `cookies()`, call `translateSupabaseError(error.message, locale)`, pass `locale` to all the `t()` calls in inline validation.

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

- **Proxy rate limiter only catches mutation paths with URL-aware routes (Phase 20 #29)** — `proxy.ts` rate limit fires for POST/PUT/PATCH/DELETE on the request URL. Server actions that submit to a page URL (e.g. login form → POST `/login`) ARE caught because the form action's URL is the page URL. BUT server actions dispatched from arbitrary pages (booking cancel → POST `/bookings/[id]`, payment start → POST `/api/payments/...`) are only throttled if their URL is in `ROUTE_CONFIG` (`lib/rate-limit.ts:46-51`). When adding a new mutation endpoint, either add it to `ROUTE_CONFIG` (per-route override) or accept the default 60/min bucket. Read-only paths (GET) are intentionally NOT throttled at the proxy — SSR render budget already constrains them and Supabase RLS limits row leakage. If you need stricter rate limiting for a specific mutation (e.g. prevent payment-card testing), tighten the per-route config — DO NOT increase the default (that's a global slowdown). Reference: `lib/rate-limit.ts:46-60`, `proxy.ts:21-41`

- **ExcelJS row.font vs cell.font are separate objects (Phase 20 #31)** — `sheet.getRow(1).font = {bold: true}` does NOT bold the cells. ExcelJS stores row-level and cell-level styling separately, and row-level assignment only sets the row's own font (read back via `row.font`). To actually bold the header, iterate: `sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true } })`. Same applies to `alignment`, `border`, `fill`. Column-level styling DOES work via `sheet.getColumn(key).numFmt = '#,##0'` (column-level numFmt applies to all cells in the column without iteration). Test pitfall: `workbook.xlsx.writeBuffer()` followed by `new ExcelJS.Workbook().xlsx.load(buffer)` drops some metadata (freeze panes, advanced borders) on round-trip — verify styling on the live workbook BEFORE serialization, not on the re-parsed copy. Reference: `app/api/manager/reports/export/route.ts:117-126`, `scripts/test-phase31-xlsx-export.mts:13-21`

- **Postgres text → enum assignment needs explicit cast (Phase 19 #19)** — `update bookings set payment_status = v_new_status` raises SQLSTATE 42804 (`column "payment_status" is of type payment_status but expression is of type text`) when `v_new_status` is a `text` plpgsql variable assigned from string literals. Fix: `set payment_status = v_new_status::payment_status` (or declare `v_new_status payment_status` and use enum-typed values from the start). Applies to any UPDATE/INSERT against `booking_status`, `payment_status`, `user_role`, `housekeeping_*`, `maintenance_*` enum columns. Same pitfall would surface in any `where enum_col = v_text_var` — the comparison also needs `enum_col::text = v_text_var` or vice versa. Caught by `scripts/test-phase19-multi-refund.mts` Cases 1/2/6 first run

- **SECURITY DEFINER RPCs need service_role bypass (Phase 19 #19 + Phase 20 #24)** — `if v_uid is null then raise exception 'Not authenticated'` rejects service_role callers (admin scripts, integration tests, walk-in tooling). Service role has `auth.uid() = NULL` but `auth.role() = 'service_role'`. Canonical fix (mirrors `20260907_fix_cancel_booking_auth.sql`):
  ```sql
  if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authenticated';
  end if;
  if v_uid is not null and not (public.has_role('manager') or public.has_role('admin')) then
    raise exception 'Not authorized';
  end if;
  ```
  And grant EXECUTE to `service_role` after the function body: `grant execute on function public.X(...) to service_role;`. The role-check guard stays in place for non-service callers (prevents privilege escalation). Always include the bypass in NEW SECURITY DEFINER RPCs that may be called from scripts or service_role-driven webhooks. Reference: `supabase/migrations/20260912_fix_approve_refund_service_role.sql:34-44`

- **Stripe refund action ordering (Phase 18)** — NEVER flip `bookings.payment_status='refunded'` ใน DB ก่อนเรียก `stripe.refunds.create()`. ถ้า Stripe call fail (network, expired PI, declined), DB จะบอก "refunded" แต่ guest's card ไม่ได้คืนเงิน — half-refund แก้ไม่ได้ (Phase 18 critical pitfall). Order เสมอ: (1) read refund_request + linked Stripe payment, (2) call `stripe.refunds.create({ payment_intent, amount? }, { idempotencyKey: buildRefundIdempotencyKey(refundId) })`, (3) then call `approve_refund` RPC. ถ้า Stripe throws → `actionFail(e, 'Stripe refund failed: …')` และ STOP — DB stays untouched, manager retry ได้. Partial-refund: action เทียบ `refund_requests.amount < payments.amount` หลัง RPC แล้ว override `bookings.payment_status='partial_refund'` โดยตรง (RPC เขียน 'refunded' เสมอ — partial_refund เป็น action-layer override ตาม D2). `buildRefundIdempotencyKey(refundId)` returns `refund:${refundId}` — Stripe SDK 24h window ป้องกัน double-charge จาก manager click ซ้ำ. Webhook RPC `confirm_refund_session` idempotent ผ่าน `provider_event_id` UNIQUE เหมือน payment flow

- **Missing check-out → cleaning-task trigger (Phase 28 fix)** — ก่อน Phase 28, `docs/phases-done.md:86` claim *"Tasks table (`housekeeping_tasks`) — สร้างอัตโนมัติจาก booking events"* was wrong: `bookings` had no trigger to insert into `housekeeping_tasks` when status flipped to `checked_out`. `checkOutBookingAction` (`app/actions/check-in-out.ts:104-185`) only writes `bookings.status='checked_out'` + a `booking_events` audit row + thank-you email — leaves housekeeping_tasks empty until the manager manually creates a row. Symptom: หลัง check-out, housekeeper's "Priority Urgent" / "Unassigned pool" list never grew automatically; manager had to use Phase 28's new `CreateTaskModal` to add the cleaning task. Fix: `20260918_housekeeping_assignment.sql` ships `on_booking_checked_out()` AFTER UPDATE trigger with `SECURITY DEFINER` + `set search_path = public`. Guard clauses: `new.status = 'checked_out' AND old.status <> 'checked_out' AND new.room_unit_id IS NOT NULL AND auth.uid() IS NOT NULL` (the last guards against service-role contexts where `auth.uid()` is NULL → would violate `created_by NOT NULL`). When adding any future auto-create trigger that fires on `bookings.status`, mirror this guard pattern. Reference: `supabase/migrations/20260918_housekeeping_assignment.sql:11-37` + `scripts/test-phase28-housekeeping-assign.mts:90-119` (Cases 1 + 2).

- **Booking `payment_status` self-update bypass (Phase 29 fix)** — ก่อน Phase 29, `bookings self update` RLS policy ที่ `20260819_bookings_rls.sql:34-41` constrained แค่ `status` column ใน `with check`, ไม่ constrain `payment_status`. User เรียก `update bookings set payment_status='refunded' where id=<own_booking>` ผ่าน PostgREST ได้ — RLS ผ่าน (own row + status unchanged), ไม่มี Stripe refund, ไม่มี `refund_requests` audit row, แต่ UI badge แสดง `'คืนเงินแล้ว'` หลอก. Manager ยัง audit ได้จาก `refund_requests` table (ยัง pending หรือไม่มี row), แต่ UI state ไม่ตรงกับความจริง — UX hole. Fix: `20260919_refund_approval_hardening.sql` widen `with check` เพื่อ constrain `payment_status` ด้วย + explicitly deny `payment_status in ('refunded','partial_refund')` flips จาก `authenticated` role. Only SECURITY DEFINER `approve_refund` RPC (manager path) หรือ `confirm_refund_session` RPC (Stripe webhook) สามารถ set ค่าเหล่านั้นได้ — ทั้งสองเส้นทางผ่าน Stripe + audit row. Reference: `supabase/migrations/20260919_refund_approval_hardening.sql:11-24` + `scripts/test-phase29-refund-hardening.mts:80-95` (Case 1).

- **Auto-allocation RPC race-safety (Phase 30)** — `allocate_housekeeping_tasks(jsonb, boolean)` RPC ใช้ `FOR UPDATE SKIP LOCKED` per task row + UPDATE `WHERE status='unassigned'`. Two managers clicking 'Rebalance' simultaneously ไม่สามารถ double-assign — one RPC succeeds per task, the other returns `skipped_reason='task_already_assigned'` or `'race_lost'`. Service-role bypass for scripts + tests. Reference: `supabase/migrations/20260920_housekeeping_allocation.sql` (section C) + `scripts/test-phase30-housekeeping-allocation.mts` Case 5.

- **Migration runner regex silently skips 20260826 + 20260828 (Phase 31 find)** — `scripts/run-migrations.mjs:103` alternation literal was `202608(27|29|30|31|32|33|34)` — missing `26` and `28`. Symptom: `20260826_fix_manager_policies.sql` (Phase 5 fix-up that widened `housekeeping_tasks` INSERT policy from `reception, admin` → `reception, manager, admin`) was tracked in `supabase/migrations/` + `db-schemas/` but **never applied to live DB**. Manager role INSERT into `housekeeping_tasks` failed with SQLSTATE 42501 → manager reported "Could not create task" when clicking "Create Task" on `/manager/housekeeping` for ชั้น 3 ห้อง 303. Fix: add `26|28` to the alternation (`202608(26|27|28|29|30|31|32|33|34)`) + apply the migration via `node scripts/run-migrations.mjs --only=20260826`. Verify RLS live with `pg_policy` SELECT — DO NOT use `scripts/run-sql.mjs` because it discards SELECT rows; use ad-hoc `pg.Client` + `pgPoolerConfig()` from `scripts/_db-connection.mjs` instead. Lesson: เมื่อเพิ่ม migration ใหม่ทุกครั้ง ต้อง verify regex pick up ก่อน — runner exit 0 แต่ไม่ apply อะไรถ้าเลขอยู่นอก alternation. The `console.log('Phase 9 + Phase 10 migrations to apply:')` block at `run-migrations.mjs:107-108` is the safety net — dry-run it after every regex change. Reference: `scripts/run-migrations.mjs:103`, `db-schemas/20260826_fix_manager_policies.sql:37-47`

- **Stale RLS policy with same USING clause silently defeats new policy (Phase 32 find)** — `create policy` ไม่ได้แทนที่ policy เดิม ถ้าเปลี่ยนชื่อ — both policies coexist และ OR-apply เข้าด้วยกัน. Symptom: tightened `room_types public read` เพิ่ม `AND deleted_at IS NULL` ใน USING clause แต่ anon+authenticated ยังเห็น soft-deleted rows เพราะ legacy policy `"public read room_types"` (จาก migration `20260819_room_types_rls.sql:15`) ยังใช้ `is_active = true` อย่างเดียว. Fix: ทุก RLS migration ที่ recreate policy under different name ต้อง `drop policy if exists "<old-name>" on <table>` ก่อน — และ verify ด้วย direct `pg_policy` SELECT (เช่น `scripts/_db-connection.mjs` + ad-hoc `.mjs`). ใช้ `pg.Client` แล้ว iterate `client.query(...).rows` — ห้ามใช้ `scripts/run-sql.mjs` เพราะ discard SELECT rows (per CLAUDE.md pitfall). Case ที่เจอ: migration `20260828_phase7_admin_foundation.sql:191-198` drop+create "room_types public read" แต่ตอน create ใหม่ใช้ชื่อเดิม — แต่หลังจากนั้นมี policy ซ้ำซ้อนที่ชื่อต่างกัน (1 policy เก่า + 1 policy ใหม่) จากการ re-arrange. Phase 32 fix: `20260925_drop_stale_room_types_policy.sql` drops the original `"public read room_types"`. Reference: `scripts/run-migrations.mjs:107` alternation must include `25` for this fix-up to apply
- **`handle_new_user()` trigger rewrite loses columns (Phase 36.1 find)** — Migration `20260913_require_phone.sql` replaced the trigger function with a smaller body that dropped the `email` and `hired_at` columns from the INSERT INTO profiles. Result: every profile created since 20260913 had `email=NULL` even though `auth.users.email` IS populated by Supabase for both email/password and Google OAuth signups. Symptom: `/admin/customers/[id]` showed email='—' for any Google OAuth customer. **Always re-run a full backfill + sanity-check after any `CREATE OR REPLACE FUNCTION public.handle_new_user()` (or other auth-related trigger)** — `select count(*) filter (where p.email is null) as missing, count(*) filter (where p.email is distinct from au.email) as mismatched` should return 0,0 after backfill. Fix: `20260929_fix_handle_new_user_email.sql` restores the columns + backfills NULL rows.
- **`x-invoke-path` header never set, sidebar active state stuck (Phase 34.6 find)** — 4 staff layouts read `headers().get('x-invoke-path')` to derive pathname, but no proxy/middleware/Next.js runtime ever sets that header (verified by `grep — 0 set sites`). Result: fallback `?? '/admin'` always won, dashboard nav item matched every page even after navigation. **Always verify any new `headers().get('<header>')` reading is actually populated somewhere** — if `grep -r "set.*<header>"` returns zero, replace with `usePathname()` from `next/navigation` (canonical client hook used by `components/layout/NavLink.tsx:21`). Fix: commit `893013f` removes the `pathname` prop from `<StaffSidebar>` / `<StaffMobileHeader>` / `<StaffSidebarNav>`; layouts no longer call `headers()`.

- **Supabase Manual Linking toggle is a runtime gate (Phase 37 find)** — `supabase.auth.linkIdentity()` and `supabase.auth.unlinkIdentity()` are server-side gated by the Supabase Dashboard "Allow manual linking" / "Enable Manual Linking" toggle at Auth → Providers → ... If the toggle is OFF, both methods return AuthApiError with message `"Manual linking is disabled"` — regardless of any code-level checks. Defense-in-depth: Phase 37's `can_link_identity_by_email()` SQL helper still runs (catches the "shouldn't even try" cases), but the actual `linkIdentity` / `unlinkIdentity` calls are gated by the toggle. Symptom: tests pass (SQL helper returns `verified_both_sides`), but `unlinkIdentity()` / `linkIdentity()` server-side rejects. Fix: enable the toggle in Supabase Dashboard → Auth → Sign In/Up (or Providers, depending on UI version) — then re-run the integration test to confirm "Manual linking is disabled" no longer appears in Case 5. Without the toggle, `signInWithOAuth` with an existing-user email also returns 422 "User already registered" (no auto-merge). Reference: `scripts/test-phase37-identity-linking.mts` Case 5, `supabase/migrations/20261001_identity_linking_helpers.sql` (defense-in-depth).


---

## 📌 Known Issues / TODO

### Code-level TODOs
**No `TODO`/`FIXME`/`HACK`/`XXX` markers found** ใน `app/`, `components/`, `lib/`, `data/`, `supabase/migrations/`, `scripts/`, หรือ config files (verified by grep 2026-08-25)

### Known gaps (documented in code as comments)
1. ~~**`partial_refund`** enum value exists but no code path writes it~~ — fixed in Phase 19 #19 (commit `23deb91`); aggregate RPC writes `partial_refund` when sum(approved) < sum(succeeded)
2. **`no_show`** was added to `booking_status` enum live (DB), not in migration file
3. ~~**`refund_requests` no INSERT policy**~~ — fixed in Phase 20 #24; `cancel_booking()` RPC inserts directly with service_role bypass
4. **Phase 7/8 admin pages** still have some pages that may not have all CRUD wired — verify before extending

### Phase 26 deferred (i18n + UI polish follow-ups — covered by the 6 i18n commits + 5 polish commits already shipped)
1. **4 of 5 email templates** still hardcode Thai (Phase 26 commit `2663118` only touched `booking-confirmation`); see Common Pitfalls above
2. **Server actions** in `app/actions/{booking,walk-in-booking,account}` still pass Thai fallback only (Phase 26 deferred)
3. **Staff dashboard sub-pages** still mostly Thai — only the 4 main dashboards were localized
4. **`AccountQuickLinks`** has 2 dead `#` placeholder links (favorite rooms, my promotions) awaiting Phase 27 features
5. **Locale cookie is never deleted on sign-out** — anonymous user on shared device keeps last user's preference
6. **No `<Modal>` primitive** — 4 hand-rolled dialogs (`DeleteReviewButton`, `HideReviewButton`, `ResolveDamageButton`, `MaintenanceReportModal`) + 1 new (`CheckEmailModal`) share near-identical backdrop markup. Refactor to a reusable primitive when a 6th dialog lands.
7. **No toast / snackbar system** — closest precedent is the inline banner pattern. Awaiting Phase 27 notification system (CLAUDE.md gap #26).

### Soft issues
- ~~`data/mock-manager.json` + `data/mock-reviews.json` ยังใช้ hardcoded test UIDs~~ — fixed: all `data/mock-*.json` deleted with mock layer
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
| #23 | **Overbooking prevention** | 🔴 Critical | ✅ Done in Phase 19 — `create_booking(...)` SECURITY DEFINER RPC + `bookings_no_unit_overlap` EXCLUDE constraint + 7 tests. See Phase 19 #19 row above. |
| #24 | **Cancellation policy enforcement** | 🔴 Critical | ✅ Done in Phase 20 — `cancel_booking(uuid, boolean, numeric)` RPC + 7 tests. See Phase 20 row above. |
| #25 | **Email infrastructure** | 🔴 Critical | ✅ Done in Phase 20 #25 — Resend + 5 React Email templates + `email_log` table. See Phase 25 row above. |
| #26 | **Notification layer** | 🟠 High | Staff bell `TopNavBar.tsx:34-39` dead button — ไม่มี `notifications` table |
| #27 | **CI/CD + automated tests** | 🟠 High | 0 `.github/`; 1 unrunnable test (`lib/pricing/seasons.test.mts`); 30 manual smoke scripts |
| #28 | **Error monitoring + analytics** | 🟠 High | 0 Sentry/PostHog/Plausible — money paths invisible |
| #29 | **App-level rate limiting** | 🟠 High | ✅ Done in Phase 20 — `lib/rate-limit.ts` token bucket + `proxy.ts` enforcement + 10 tests |
| #30 | **Compliance + 404 fixes** | 🟠 High | Partially done (Phase 20 #30 = stub pages) — 2FA / GDPR / cookie consent still TODO |
| #31 | **Document generation (PDF/Excel)** | 🟡 Medium | Excel done in Phase 20 #31 — PDF still TODO |
| #32 | **i18n + shift scheduling UI** | 🟡 Medium | i18n done (Phase 26) — `staff_shifts` write UI still TODO |

### Phase 27 — Backlog (next round of work, after Phase 26 polish)
1. **Phase 27.A** — Modal primitive (`components/ui/Modal.tsx`) — consolidate the 5 hand-rolled dialogs
2. **Phase 27.B** — Toast / snackbar system — replace all `alert(...)` calls in client components
3. **Phase 27.C** — Server actions in `app/actions/{booking,walk-in-booking,account}` thread `locale` into `t()` + `translateSupabaseError`
4. **Phase 27.D** — Remaining 4 email templates + locale-aware server actions that call `sendEmail()`
5. **Phase 27.E** — Staff dashboard sub-pages (8 manager + 8 reception + 4 housekeeper + 5 admin sub-pages) — bulk i18n pass
6. **Phase 27.F** — `AccountQuickLinks` remove dead `#` placeholders OR implement favorite rooms + user promotions features
7. **Phase 27.G** — Locale cookie deletion on sign-out
8. **Phase 27.H** — Replace `alert()` calls + a few inline error toasts with the new toast system

### Quick wins (≤1 commit, no breaking change)
- **#30 (404 fix only)** — ✅ Done in Phase 20 #30 — stub pages
- **#28 (Sentry only)** — install SDK + wire `global-error.tsx` (~30 min)
- **#17 (Phase 19-A)** — ✅ Done in Phase 19 #19 — multi-refund aggregation (commit `23deb91`)
- **#32 (i18n only)** — ✅ Done in Phase 26 — 12 commits shipped

### Recommended Phase 27 sequence (when resumed)
27.A (1-2h, 1 commit) → 27.C (1-2h, 1 commit) → 27.D (1-2h, 1 commit) → 27.B (3-4h, 2 commits) → 27.E (4-6h, bulk i18n across 25 files) → 27.F (cleanup, 30 min) → 27.G (10 min) → 27.H (30 min)

### Reference files (gap evidence)
- Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md` (full Top 10 + 7-category audit)
- Phase 18 master plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md` (Phase 19 deferred items)

---

## 📜 Memories (cross-session context)

Saved memories in `~/.claude/projects/Y--Final/memory/`:
- `nextjs16-call-server-action-via-http.md` — `$ACTION_ID_<id>` field pattern
- `zenzero-gitignore-pushed.md` — .gitignore now committed (since 2026-08-22)
- `zenzero-local-only-files.md` — list of files kept in working tree only
- `zenzero-liststub-pitfall.md` — ~~check supabase-*.ts for `return []` stubs~~ obsolete; mock layer deleted, dispatcher is direct re-export
- `zenzero-rls-recursion-fix.md` — use is_staff()/has_role() helpers
- `zenzero-phase9-live-verified.md` — 43/43 smoke tests passed
- ~~`zenzero-usemock-data-wrapper.md`~~ — obsolete; mock layer deleted
- `zenzero-test-cleanup-needs-service-role.md` — admin RLS blocks DELETE
- `zenzero-stripe-test-fixture-pitfalls.md` — PI must be confirmed before refund; refunds.list() .data is the array; server actions HTTP 200 ≠ success

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
| **Supabase error helpers** | `lib/errors/supabase.ts` (`wrapSupabaseError` + `actionFail` — Phase 16 + Phase 26 EN map) |
| **Shared UUID validator** | `lib/ids.ts` (`UUID_RE` + `isUuid` — Phase 16, replaces 2 duplicate defs) |
| **`sanitizeNext` helper** | `lib/auth/sanitize.ts` (relocated from `app/auth/next-utils.ts` — Phase 16) |
| **i18n infrastructure** | `lib/i18n/{config,getLocale,t,I18nProvider,useT}.ts` + `dictionaries/{th,en}.ts` (Phase 26) |
| **Language toggle** | `components/layout/LanguageToggle.tsx` (client island) + `app/actions/locale.ts:setLocaleAction` |
| **Email + R2 helpers** | `lib/email/resend.ts` (sendEmail + email_log) + `lib/r2/client.ts` (R2 SDK) + `lib/r2/publicUrl.ts` (URL builder) |
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