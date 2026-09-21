# Zenzero Hotel

> **Full-stack hotel management system** — booking, operations, and back-office
> in one Next.js 16 app with Supabase (Postgres + Auth + RLS) and Cloudflare R2.

5 role tiers — **Customer**, **Reception**, **Housekeeper**, **Manager**, **Admin** —
each with their own dashboards, permissions, and server actions.

Originally prototyped as static HTML at `Y:/Final/V1_Prototype/extracted/`, then
rebuilt into a typed Next.js + Supabase app across **38 phases** (see `docs/phases-done.md`).

> ✅ **Phase 37 + Phase 38 shipped (2026-09-20)** — Identity linking + remove User self-delete:
>
> - **Phase 37 — Identity linking** — User can sign in via BOTH email/password AND Google OAuth on the same account. `supabase/migrations/20261001_identity_linking_helpers.sql` adds `public.can_link_identity_by_email(text, boolean)` SECURITY DEFINER helper that requires email_verified=true on BOTH sides. UI: new `LinkedAccountsCard` ("วิธีเข้าสู่ระบบ") on `/account/profile` with Connect Google / Set Password / Disconnect controls. `AccountSecuritySection` branches ChangePassword vs SetPassword based on whether email identity exists. Requires **Supabase Dashboard → Auth → Providers → "Allow manual linking" toggle = ON** (verified by `scripts/test-phase37-identity-linking.mts` Case 5).
> - **Phase 38 — Remove User self-delete** — Removed the "ลบบัญชีผู้ใช้" Danger Zone section from `/account/profile`. Deleted `components/account/DeactivateAccountSection.tsx` + `deactivateAccountAction` + `deactivateOwnAccount`. Admin staff still controls `profiles.is_active` via `/admin/staff`. 0 DB changes.
>
> Commits `b9860aa` (Phase 37) + `9cb5376` (Phase 38). Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`.
>
> ✅ **Phase 26 shipped (2026-09-05)** — i18n (TH/EN) + UI polish + /account profile + validation + email confirmation. 21 commits on `origin/main` (commits `44c9f14` → `10472c7`):
>
> - **i18n full coverage** — `lib/i18n/{config,getLocale,t,I18nProvider,useT}.ts` + `dictionaries/{th,en}.ts` (600+ strings across 12 namespaces). `setLocaleAction` server action + `NEXT_LOCALE` cookie + `LanguageToggle` client island. 36 pages + 5 email templates + XLSX export headers + `lib/errors/translate.ts` all threaded through `t()`.
> - **/account profile page** (Role User) — `app/account/profile/page.tsx` + 6 client components (ProfileCard, AvatarUploader, PersonalInfoForm, ChangePasswordForm, DeactivateAccountSection, AccountQuickLinks) + `app/actions/account.ts` with R2 avatar upload + soft-delete.
> - **UI polish** — sitewide `prefers-reduced-motion` a11y rule, `<Card>` lift variant, hover transitions + focus rings on 13 admin/manager icon buttons, chevron/arrow slide, standardized tab durations.
> - **Validation** — `bookerPhone` regex `/^[0-9]{10}$/` enforced on booking + account + walk-in + register actions.
> - **Supabase email confirmation** — signUp redirects to `/register?message=check_email&next=…` with `emailRedirectTo` set to `/auth/callback?next=…`. Requires Dashboard toggle: Auth → Providers → Email → Confirm email = ON.
>
> Plan: `C:\Users\suns9\.claude\plans\database-swirling-hoare.md`.
>
> ✅ **Phase 20 #29, #31 + Phase 19 #19 shipped (2026-09-04)** — Three production-hardening blocks on `origin/main` (commits `b4b8352`, `2b59f6a`, `23deb91`):
>
> - **Phase 20 #29** — App-level rate limiting (`lib/rate-limit.ts` token-bucket + LRU + 10/min login + 5/min register + 20/min OAuth callback + 10/min payments checkout). 429 + Retry-After on burst.
> - **Phase 20 #31** — Excel export for manager reports (`app/api/manager/reports/export/route.ts` streams `getReportsData()` as 6-sheet `.xlsx`; RBAC manager/admin).
> - **Phase 19 #19** — Multi-refund aggregation (`approve_refund` + `confirm_refund_session` SECURITY DEFINER RPCs now compute `payment_status` from `sum(approved_refunds) vs sum(succeeded_payments)`; closes gap where multiple partial refunds clobbered `partial_refund` → `refunded`).
>
> Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`.
>
> ✅ **Phase 25 shipped (2026-09-04)** — Email infrastructure (Phase 20 Block 3): Resend + React Email + `email_log` table (event_key UNIQUE idempotency) + 5 Thai templates (booking_confirmation / payment_receipt / cancellation_notice / refund_notice / checkout_thank_you) + 5 server-action / webhook hooks + 7 integration tests. Plan: `C:\Users\suns9\.claude\plans\distributed-tickling-bird.md`.
>
> ✅ **Phase 20 #30 (404 stubs) + Phase 20 #28 (Sentry) shipped (2026-09-04)** — Stub pages (`/privacy`, `/terms`, `/about`, `/contact`, `/careers`, branded `not-found.tsx`) + Sentry Next.js SDK (`sentry.{client,server}.config.ts` + `instrumentation.ts` + `app/global-error.tsx` + `withSentryConfig` wrapper); all optional via empty env vars.
>
> ✅ **Phase 19 shipped (2026-09-03)** — Overbooking prevention (Phase 20 Block 1): `create_booking` SECURITY DEFINER RPC + EXCLUDE constraint + 7 integration tests. Plan: `C:\Users\suns9\.claude\plans\project-quirky-storm.md`.
>
> ✅ **Phase 18 shipped (2026-09-03)** — 5 commits on `origin/main`:
> `confirm_refund_session(text,text)` RPC + `charge.refunded` webhook handler +
> `approveRefundAction` rewrite (Stripe call BEFORE DB flip per D5 ordering) +
> partial_refund override + `refund_approved` audit row + 19/19 integration tests.
> Plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md`.

---

## ✨ Features ที่เด่น

- **Role-based access control** ผ่าน Next.js 16 `proxy.ts` + per-role layout
  re-checks (defense-in-depth) — 5 roles แต่ละ role gate ทั้ง 2 layer, single
  source of truth คือ `roleHomePath()` ใน `lib/supabase/getSession.ts` (Phase 11)
- **Atomic refund approval** ผ่าน `approve_refund(uuid)` SECURITY DEFINER RPC
  (Phase 10) — flip `refund_requests.status='approved'` และ
  `bookings.payment_status='refunded'` ใน transaction เดียว พร้อม double-decision guard
- **Stripe payment gateway** (Phase 17) — `payments` table + Checkout Session +
  `charge.refunded` webhook → `confirm_refund_session` RPC + promptpay/cards ใน THB;
  webhook HMAC-verified + idempotent ผ่าน `provider_event_id` UNIQUE
- **Multi-refund aggregation** (Phase 19 #19) — `approve_refund` + `confirm_refund_session`
  RPCs sum `approved_refunds` vs `succeeded_payments` per booking เพื่อคำนวณ
  `payment_status` (refunded / partial_refund); lock booking row ป้องกัน race
- **Email infrastructure** (Phase 25) — Resend + React Email + 5 Thai templates
  (booking confirmation / payment receipt / cancellation notice / refund notice /
  checkout thank-you) ผ่าน `email_log` table ที่มี `event_key` UNIQUE สำหรับ idempotency
- **App-level rate limiting** (Phase 20 #29) — token-bucket + LRU ใน `proxy.ts`
  throttling login (10/min), register (5/min), OAuth callback (20/min), payments
  checkout (10/min); return 429 + Retry-After บน empty bucket
- **Excel export for reports** (Phase 20 #31) — `app/api/manager/reports/export`
  stream `getReportsData()` เป็น 6-sheet `.xlsx` (สรุปภาพรวม + รายได้รายวัน +
  Occupancy YoY + ห้องที่ถูกจองมากที่สุด + ประเภทห้องที่มีรายได้สูงสุด + ช่องทางการจอง)
- **Error monitoring** (Phase 20 #28) — Sentry Next.js SDK ผ่าน `withSentryConfig`
  + `sentry.{client,server}.config.ts` + `app/global-error.tsx` + `instrumentation.ts`;
  optional ผ่าน empty `SENTRY_DSN` env vars
- **404 stubs** (Phase 20 #30 subpart) — `/privacy`, `/terms`, `/about`, `/contact`,
  `/careers` pages + branded `app/not-found.tsx` (closes 5+ live 404s)
- **Seasonal pricing engine** (Phase 8) — `quoteStay()` รวม seasonal rate overrides,
  `min_nights_override`, คำนวณ baseSubtotal + discount + tax (7%) + resort fee (150 THB/night)
- **Live availability + room status** — `room_units` พร้อม status enum
  (`available, occupied, cleaning, maintenance, out_of_order`),
  trigger `on_task_status_change()` sync กับ housekeeping task lifecycle
- **Review moderation** พร้อม staff guard trigger — staff แก้ review ได้เฉพาะ
  `status/moderated_by/moderated_at`, แตะ field อื่นโดน `reviews_guard_staff_update()` block
- **Cloudflare R2 image storage** — room images เก็บใน R2, URLs build
  ผ่าน `lib/r2/publicUrl.ts`
- **TH/EN language switcher** (Phase 26) — click "EN" ใน nav เพื่อสลับภาษา
  ทั้ง UI + email templates + XLSX export headers; cookie persistence
  + `profiles.locale` persistence + `hotel_settings.locale_default`
  fallback
- **/account profile page (Role User)** — avatar upload (R2) + personal
  info (TH/EN) + password change + LinkedAccountsCard ("วิธีเข้าสู่ระบบ"
  for multi-provider sign-in — Phase 37)
- **Identity linking (Phase 37)** — user can sign in via BOTH email/password
  AND Google OAuth into the SAME Supabase account. Defense-in-depth
  `can_link_identity_by_email()` SQL helper requires email_verified=true
  on BOTH sides before any merge. UI at `/account/profile` → "วิธีเข้าสู่ระบบ"
  card lists connected providers + Connect/Disconnect/Set-Password
  controls. Requires Dashboard "Allow manual linking" toggle = ON.
- **Stacked RLS policies** — public read + self-only + staff via
  `is_staff()` / `has_role(text)` SECURITY DEFINER helpers (ห้าม inline EXISTS
  — เกิด Postgres 42P17 recursion)
- **Google OAuth login + register** (Phase 14) — Supabase hosted OAuth ผ่าน
  `signInWithOAuth({ provider: 'google' })`; handler เดียวกันใน LoginForm +
  RegisterForm; error banner surfaces `provider is not enabled` จาก dashboard
  พร้อมคำแนะนำภาษาไทยแทน silent failure
- **Dashboard charts** — chart.js + react-chartjs-2 (revenue line, occupancy bar,
  channels donut) — render ฝั่ง server เป็น Server Component
- **Live-DB smoke tests** — `scripts/test-phase*-*.mts` ยิง HTTP actions +
  direct `.rpc()` เช็ค DB state, เป็น end-to-end verifier

---

## 🧰 Tech Stack

| Layer | ใช้อะไร |
|---|---|
| Framework | **Next.js 16.3.0** (App Router, Turbopack) |
| Runtime | React 19.2.8, TypeScript 5.x (strict) |
| Styling | Tailwind CSS v4.3.3 (CSS-only `@theme {}` config — ไม่มี `tailwind.config.ts`) |
| Database | **Supabase** (Postgres + Auth + RLS) — `@supabase/ssr@^0.5.2`, `@supabase/supabase-js@2.112.3` |
| Images | **Cloudflare R2** — `@aws-sdk/client-s3@3.1112.0` (S3-compatible) |
| Validation | Zod 3.25.76 |
| Date math | date-fns 3.6.0 |
| Charts | chart.js 4.x + react-chartjs-2 5.x |
| Email | **Resend** + `@react-email/components` — 5 transactional templates |
| Excel export | `exceljs` |
| Auth flow | Next.js 16 `proxy.ts` (replaces `middleware.ts`) — Supabase SSR cookies |

**Node version requirement**: ไม่ pin ใน `package.json` — แนะนำ Node ≥ 20.x (จาก Next.js 16 requirements) [ต้องยืนยัน]

---

## 🎯 ฟีเจอร์หลักแยกตามฝั่งผู้ใช้

### ลูกค้า (ไม่ต้อง login)

- **Homepage** `/` — featured rooms, marketing
- **Browse rooms** `/rooms` — search + filter
- **Room detail** `/rooms/[id]` — gallery + amenities + booking widget
- **Login** `/login`, **Register** `/register`

### ลูกค้า (logged-in)

- **My bookings** `/bookings` — list
- **Booking detail** `/bookings/[id]` — ดู/ยกเลิก + submit review (หลังเช็คเอาท์)
- **New booking** `/bookings/new` — confirmation step

### Reception (role: `reception` or `admin`)

- `/reception` — dashboard (today arrivals/departures, in-house guests)
- `/reception/check-in-out` — walk-in check-in / check-out workflow
- `/reception/customers` — guest directory
- `/reception/requests` — in-stay guest requests
- `/reception/rooms` — room grid (occupied/vacant/OOO)
- `/reception/bookings` — all bookings (filtered by desk)
- `/reception/bookings/new` + `/create` — walk-in / phone booking form
- `/reception/history` — past-stay records

### Housekeeper (role: `housekeeper` or `admin`)

- `/housekeeper` — dashboard (today's task count)
- `/housekeeper/tasks` — task list (claim / start / complete)
- `/housekeeper/rooms` — room status update
- `/housekeeper/maintenance` — file maintenance ticket
- `/housekeeper/history` — past task log

### Manager (role: `manager` or `admin`)

- `/manager` — KPI dashboard (revenue, occupancy, alerts)
- `/manager/bookings` — bookings oversight + refund approval queue
- `/manager/housekeeping` — HK performance oversight
- `/manager/reports` — revenue + occupancy + channels reports (chart.js)
- `/manager/reviews` — review moderation queue
- `/manager/settings` — manager-editable hotel settings
- `/manager/promotions`, `/manager/rates`, `/manager/staff`, `/manager/staff/shift`

### Admin (role: `admin` เท่านั้น)

- `/admin` — admin dashboard
- `/admin/promotions` (+ `new`, `[id]/edit`) — CRUD promotions
- `/admin/staff` (+ `new`, `[id]/edit`) — CRUD staff + assign role + soft-delete
- `/admin/settings` — hotel-wide settings editor (singleton row)
- `/admin/rates/room-types` (+ `new`, `[id]/edit`) — CRUD room types (3 tabs: active/inactive/deleted)
- `/admin/rates/seasonal-rates` (+ `new`, `[id]/edit`) — CRUD seasonal rates
- `/admin/customers` (+ `[id]`) — **Customer Management**: list + search + suspend/unsuspend. Suspended customers blocked at app-layer from login + booking creation. Admin-only.

---

## 🚀 ติดตั้ง & รัน

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

แก้ `.env.local` ด้วย credentials จริง — ตัวแปรที่ต้องตั้ง:

| Variable | Exposure | ต้องตั้งเมื่อ |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **public (client)** | Base URL สำหรับ SSR/build — เช่น `http://localhost:3000` |
| `USE_MOCK_DATA` | server-only | `1` = ใช้ mock data layer, `0` = ใช้ Supabase จริง |
| `NEXT_PUBLIC_SUPABASE_URL` | **public (client)** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **public (client)** | Supabase anon JWT (safe — RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | RLS bypass — สำหรับ admin scripts + test cleanup |
| `SUPABASE_DB_PASSWORD` | **server-only** | Postgres password สำหรับ migration runner |
| `R2_ACCOUNT_ID` | server-only | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | server-only | R2 access key |
| `R2_SECRET_ACCESS_KEY` | **server-only** | R2 secret |
| `R2_BUCKET_NAME` | server-only | R2 bucket name |
| `R2_PUBLIC_URL` | **public (client)** | R2 public CDN URL prefix |
| `NEXT_PUBLIC_TAX_RATE` | **public (client)** | ค่า default `0.07` [ต้องยืนยัน ว่าถูกใช้ที่ไหน] |
| `NEXT_PUBLIC_RESORT_FEE` | **public (client)** | ค่า default `150` [ต้องยืนยัน ว่าถูกใช้ที่ไหน] |

⚠️ `USE_MOCK_DATA` evaluate **at module load time** — เปลี่ยนค่าแล้วต้อง restart `npm run dev` ไม่งั้น actions ทุกตัวยังไป mock layer (เช่น `lib/data/manager.ts:4`)

### 3. Apply database migrations

```bash
# Apply ทุก pending migrations (filtered to 202608(27|29|30|31|32|33|34) + 202609(02|03|04|05|06|07|08|09|10|11|12))
node scripts/run-migrations.mjs

# Apply migration เดียว
node scripts/run-migrations.mjs --only=20260912

# Dry-run ดูว่าจะ apply อะไร
node scripts/run-migrations.mjs --dry-run
```

**Migration filter ปัจจุบัน** (`scripts/run-migrations.mjs:107`):
`/202608(26|27|28|29|30|31|32|33|34)|202609(02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29)_.*\.sql$/` — migrations 18–26 และ 28 apply ผ่าน
Supabase Dashboard SQL editor ไปแล้ว (ยกเว้น 20260929 ที่ apply ผ่าน runner)

**หลัง apply migration ใหม่**: copy file ไปที่ `Y:\Final\db-schemas\` (local archive)

### 4. Seed test data (optional, fresh DB only)

```bash
# Run supabase/seed.sql + supabase/seed_housekeeping.sql via Supabase Dashboard SQL editor
# Test users create via curl (per supabase/seed.sql:1 docs)
```

Test accounts (post-seed; passwords overridable ผ่าน `*_TEST_PASSWORD` env):
```
admin@zenzero.com        / AdminPass123!       — admin (full access)
manager@zenzero.com      / ManagerPass123!     — manager
reception@zenzero.com    / ReceptionPass123!   — reception (สร้างโดย scripts/_rbac-fixture.mts)
somjit@zenzero.com       / Housekeep123!       — housekeeper (มาจาก seed_housekeeping.sql)
test@zenzero.com         / TestPass123!        — user (ถูก reset role=user โดย scripts/_rbac-fixture.mts)
```

> ⚠️ รัน `npx tsx scripts/_rbac-fixture.mts` ครั้งเดียวก่อน `test-phase11-rbac.mts`
> ถ้า seed users เปลี่ยน role ไปจากเดิม (script idempotent — รันซ้ำได้)

### 5. Start dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## 📜 Available Scripts

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | Start dev server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint (flat config + Next.js presets) |
| `npm run typecheck` | `tsc --noEmit` (ไม่รวม `scripts/` — scripts ใช้ `npx tsx` type-strip) |
| `npm run db:migrate` | Apply pending migrations (เหมือน `node scripts/run-migrations.mjs`) |
| `npm run images:migrate` | Upload prototype images from `Y:/Final/V1_Prototype/` → R2 |

### Test scripts (run individually)

```bash
npx tsx scripts/test-phase11-rbac.mts           # Phase 11 — RBAC redirect matrix (48/48)
npx tsx scripts/_rbac-fixture.mts               # Reset test user roles (idempotent)
npx tsx scripts/test-phase10-kpi-trend.mts      # Phase 10 — KPI accuracy
npx tsx scripts/test-phase10-refund-rpc.mts     # Phase 10 — refund RPC
npx tsx scripts/test-phase18-stripe-refund.mts  # Phase 18 — Stripe refund wiring (19/19)
npx tsx scripts/test-phase19-multi-refund.mts   # Phase 19 #19 — multi-refund aggregation (7/7)
npx tsx scripts/test-phase20-overbooking.mts    # Phase 20 #23 — overbooking prevention (7/7)
npx tsx scripts/test-phase24-cancel-policy.mts  # Phase 20 #24 — cancellation policy enforcement (7/7)
npx tsx scripts/test-phase25-email.mts          # Phase 25 — email infrastructure (7/7)
npx tsx scripts/test-phase29-rate-limit.mts     # Phase 20 #29 — app-level rate limiting (10/10)
npx tsx scripts/test-phase31-xlsx-export.mts    # Phase 20 #31 — Excel export for manager reports (10/10)
npx tsx scripts/test-phase37-identity-linking.mts # Phase 37 — identity linking (5/5; Case 5 verifies Manual Linking toggle)
npx tsx scripts/test-deactivate-fix.mts         # Phase 26 deactivate-bug fix — code invariants (action removed in Phase 38 but history preserved)
npx tsx scripts/_cleanup-test-rows.mts          # Cleanup leaked test bookings
```

---

## 📁 โครงสร้างโฟลเดอร์หลัก

```
Y:\Final\final\
├── app/                       # Next.js App Router
│   ├── (auth)/                # /login, /register (public; authed users redirected)
│   ├── (public)/              # home + rooms (public browse)
│   ├── (booking)/             # /bookings/* (logged-in users)
│   ├── reception/             # /reception/* (reception + admin)
│   ├── housekeeper/           # /housekeeper/* (housekeeper + admin)
│   ├── manager/               # /manager/* (manager + admin)
│   ├── admin/                 # /admin/* (admin only)
│   ├── actions/               # Server actions (auth, booking, manager, housekeeping, reviews, rates, promotions, admin/*)
│   ├── layout.tsx             # Root layout — Playfair Display + Inter + Material Symbols
│   ├── globals.css            # @theme {} design tokens (brand colors, spacing, shadows)
│   └── page.tsx               # Homepage
│
├── components/                # 82 .tsx — by domain
│   ├── ui/                    # MaterialIcon, Card, Button, Tabs
│   ├── layout/                # TopNavBar, Footer, StaffSidebar, ScrollNavIsland
│   ├── room/                  # RoomCard, RoomDetail, BookingWidget, Amenity*, Review*
│   ├── search/                # SearchBar, FilterSidebar, FilterChips, SearchSummaryCard
│   ├── housekeeping/          # TaskCard, StatusBadge, MaintenanceReport*, 10 อื่นๆ
│   ├── manager/               # KPI/Table/Chart/Action components (~50 files)
│   ├── admin/                 # 11 CRUD forms + tables
│   ├── feedback/EmptyState.tsx
│   └── landing/HeroSection.tsx
│
├── lib/                       # Pure utilities + Supabase wrappers
│   ├── data/                  # Toggle layer — mock vs Supabase
│   │   ├── manager.ts         # 32 exports (manager + admin CRUD wrapped) + getPricingConstants() helper
│   │   ├── admin.ts           # Service-role client factory (lib/supabase/admin.ts equivalent)
│   │   ├── rooms.ts           # 7 exports (uses validated isUsingMockData)
│   │   ├── bookings.ts        # Supabase-only (no toggle)
│   │   ├── reviews.ts         # 7 exports
│   │   ├── staff.ts           # Supabase-only
│   │   ├── housekeeper.ts     # 7 exports
│   │   ├── types.ts           # 443 lines — all shared types
│   │   ├── mock-*.ts          # In-memory state (USE_MOCK_DATA=1 only)
│   │   └── supabase-*.ts      # Real PostgREST queries
│   ├── auth/                  # Auth helpers (Phase 16 refactor)
│   │   ├── require.ts         # requireRole(allowed, redirectPath?) — replaces 11 inline requireXxx helpers
│   │   └── sanitize.ts        # sanitizeNext(next) — guards open-redirect on ?next= param (relocated from app/auth/next-utils.ts)
│   ├── errors/                # Error helpers (Phase 16 refactor)
│   │   └── supabase.ts        # wrapSupabaseError(label, e) + actionFail(e, fallback) — replaces 70 throw sites
│   ├── ids.ts                 # UUID_RE + isUuid(v) — shared UUID validator (replaces 2 duplicate defs)
│   ├── supabase/              # server.ts, client.ts, proxy.ts, getSession.ts, admin.ts
│   ├── pricing.ts             # calculateNights, applyPromotion, calculatePrice, formatTHB, generateBookingCode
│   ├── pricing/seasons.ts     # pickSeasonalRate, quoteStay, violatesMinNights
│   ├── dates.ts               # formatDate, formatDateTime, formatTime (Intl)
│   ├── r2/                    # publicUrl.ts (r2Url, imageUrl), client.ts (S3Client)
│   └── env.ts                 # Validated env access (isUsingMockData, hasSupabase, hasR2)
│
├── data/                      # Mock JSON files (only loaded when USE_MOCK_DATA=1)
│   ├── mock-rooms.json        # 10 room types with explicit UUIDs
│   ├── mock-amenities.json    # 8 amenities
│   ├── mock-housekeeper.json  # 12 tasks + 5 maintenance reports
│   ├── mock-manager.json      # Dashboard/HK/Bookings/Reports mock data
│   └── mock-reviews.json      # 6 reviews (approved/pending/hidden mix)
│
├── supabase/                  # In .gitignore — local-only DB files
│   ├── migrations/            # 34 numbered SQL files (20260818_*.sql → 20260912_*.sql)
│   ├── seed.sql               # doc-only — curl snippet for Auth API user creation
│   └── seed_housekeeping.sql  # 10 tasks + 5 maintenance reports
│
├── scripts/                   # Operational + test scripts (excluded from tsconfig)
│   ├── run-migrations.mjs     # SQL migration runner (Supabase Pooler)
│   ├── run-sql.mjs            # One-off SQL runner
│   ├── migrate-images.mjs     # Prototype images → R2 uploader
│   ├── test-phase*-*.mts      # Live-DB smoke tests
│   └── ... (40+ scripts total — see CLAUDE.md for inventory)
│
├── proxy.ts                   # Next.js 16 Proxy — entry point at root
├── next.config.ts             # images.remotePatterns (R2 + legacy Google)
├── tsconfig.json              # strict + path alias @/*
├── package.json               # scripts + deps
├── eslint.config.mjs          # Flat config + Next.js presets
├── postcss.config.mjs         # @tailwindcss/postcss plugin
└── .env.example               # Template (copy to .env.local)
```

### Side directories (outside project root)

- **`Y:\Final\db-schemas\`** — local archive ของ `supabase/migrations/` + `seed*.sql`
  (mirror ทุกครั้งหลัง apply migration ใหม่)

---

## 🗄️ Database (high-level)

34 migrations, Phase 1 → Phase 25 + Phase 19/20 deferred (full detail ใน `db-schemas/`):
- **Phase 11**: ไม่มี migration ใหม่ — RBAC code-only fix (proxy.ts + layout + signIn)
- **Phase 12**: `20260834` (bookings.channel + bookings.room_unit_id) — รองรับ walk-in booking + room assignment ตอน check-in
- **Phase 14**: ไม่มี migration ใหม่ — Google OAuth code-only (Supabase hosted flow + error surfacing)
- **Phase 15**: ไม่มี migration — DB documentation (Word + draw.io prompt ใน `Y:\Final\db-schemas\`)
- **Phase 17**: `20260902` (`payments` table + 3 SECURITY DEFINER RPCs + Stripe Checkout + webhook)
- **Phase 18**: `20260903` (`confirm_refund_session(text,text)` RPC + Stripe refund wiring — `charge.refunded` webhook + `approveRefundAction` rewrite with D5 ordering + partial_refund override + audit row + 19/19 tests)
- **Phase 19 #23 (Phase 20 Block 1)**: `20260904` (`create_booking` SECURITY DEFINER RPC + `btree_gist` extension + `bookings_no_unit_overlap` EXCLUDE constraint — overbooking prevention; web + walk-in flows refactored; 7-case integration test). `20260905` is fix-up for FOR UPDATE on aggregate (PERFORM 1 + separate COUNT)
- **Phase 20 #24 (Phase 20 Block 2)**: `20260906` (`cancel_booking(uuid, boolean, numeric)` RPC enforcing free_cancel_hours + refund_pct + audit + refund_requests insert). `20260907` is service_role bypass + state guard tightening
- **Phase 25 (Phase 20 Block 3)**: `20260908` (`email_log` table — event_key UNIQUE idempotency + RLS staff SELECT + manager UPDATE; FKs to bookings/payments/refund_requests with ON DELETE SET NULL)
- **Phase 19 #17**: `20260909` (`payments` CHECK constraint `amount > 0` — defense against zero-amount refund/payment rows)
- **Phase 19 #18**: `20260910` (`confirm_refund_session` partial_refund guard — webhook now preserves `payment_status='partial_refund'` instead of unconditionally clobbering to 'refunded')
- **Phase 19 #19**: `20260911` (`approve_refund` + `confirm_refund_session` aggregate logic — sum(approved_refunds) vs sum(succeeded_payments) for correct multi-refund payment_status). `20260912` is service_role bypass + enum cast fix-up

| Phase | Migrations | What |
|---|---|---|
| 1 | `20260818_init`, `20260818_rls` | Room types, amenities, profiles, auth trigger |
| 2 | `20260819_bookings*` | Bookings, reviews, cancellation policies, promotions |
| 3 | `20260820_staff*` + `20260820_fix_rls_recursion` | Staff role, room_units, booking_events, RLS helpers |
| 4 | `20260821/22/23` | Housekeeping + maintenance tables + RLS |
| 5 | `20260824/25/26` | Room units updated_at + manager role + fix over-broad policies |
| 6 | `20260827` | Reviews moderation (status column + guard trigger) |
| 7 | `20260828` (+ `fix_admin_policies_recursion`) | Hotel settings, seasonal rates, admin CRUD |
| 8 | `20260829/30/31` | Promotions write + damage reports + refund requests + booking_events seed |
| 9 | `20260832` | Staff shifts, profiles.email/hired_at |
| 10 | `20260833` | `approve_refund(uuid)` RPC |
| 12 | `20260834` | `bookings.channel` + `bookings.room_unit_id` (walk-in + unit assignment) |
| 16 | _(no migration)_ | Refactor + clean-up pass — `lib/auth/require.ts` + `lib/errors/supabase.ts` + `lib/ids.ts` + `lib/auth/sanitize.ts`; deleted dead code + swept Phase-X comments; full plan ที่ `C:\Users\suns9\.claude\plans\nifty-chasing-raccoon.md` |
| 17 | `20260902` | Stripe payment gateway — `payments` table + `create_payment_session` / `confirm_payment_session` / `expire_payment_session` SECURITY DEFINER RPCs + webhook + `createCheckoutSessionAction`/`markCashPaidAction`; plan: `y-final-screenshot-card-zesty-puppy.md` (Phase 17) |
| 18 | `20260903` | Stripe refund wiring — `confirm_refund_session(text,text)` RPC + `charge.refunded` webhook + `buildRefundIdempotencyKey` + `approveRefundAction` rewrite (Stripe call BEFORE RPC per D5 ordering) + `partial_refund` override + `refund_approved` audit row + 19/19 integration tests; plan: `C:\Users\suns9\.claude\plans\y-final-screenshot-card-zesty-puppy.md` (Phase 18) |
| 19 | `20260904`, `20260905` | Overbooking prevention (Phase 20 Block 1) — `create_booking(...)` SECURITY DEFINER RPC with `PERFORM 1 ... FOR UPDATE` row lock on room_units pool + overlapping booking rows + `daterange && daterange` overlap count; defense-in-depth EXCLUDE constraint `bookings_no_unit_overlap` on `(room_unit_id, daterange)` for `confirmed`/`checked_in` rows; web + walk-in flows refactored; 7-case integration test passes (single insert, non-overlapping, overlapping rejection, cancel+rebook, 5-way concurrent, walk-in-vs-web, EXCLUDE constraint); plan: `C:\Users\suns9\.claude\plans\project-quirky-storm.md`. `20260905` is a fix-up for the FOR UPDATE on aggregate bug shipped in `20260904` |
| 20 | `20260906`, `20260907` | Cancellation policy enforcement (Phase 20 Block 2) — `cancel_booking(uuid, boolean, numeric)` SECURITY DEFINER RPC locks booking `FOR UPDATE`, validates `status='confirmed'`, looks up linked `cancellation_policy` (or `is_default=true` fallback), computes `refund_amount` via `free_cancel_hours` + `refund_pct` + optional staff override, flips status, inserts `refund_requests` row when paid + refund > 0, inserts `booking_events` audit. `app/actions/booking.ts` — guest `cancelBooking` + new `cancelBookingByStaff(bookingId, refundPctOverride)`; UI surfaces policy name + refund/penalty in guest + staff cancel dialogs. 7-case integration test passes (Flexible full refund, NULL-policy → default, checked-in blocked, double-cancel blocked, unpaid → no refund row, staff override 100%, audit metadata). Closes contractual gap where cancel always gave 100% refund. `20260907` is a fix-up: service_role bypass for auth.uid() + explicit `::user_role` cast + state guard tightened from `(confirmed, checked_in)` to `confirmed` only + `refund_amount=0` for `payment_status<>'paid'` |
| 20 #29 | _(no migration)_ | App-level rate limiting (Phase 20 #29) — `lib/rate-limit.ts` token-bucket + LRU in `proxy.ts`; throttling login (10/min), register (5/min), OAuth callback (20/min), payments checkout (10/min); 429 + Retry-After; 10-case integration test passes |
| 20 #30 (subpart) | _(no migration)_ | 404 stubs — `/privacy`, `/terms`, `/about`, `/contact`, `/careers` pages + branded `app/not-found.tsx`; closes 5+ live 404s |
| 20 #31 | _(no migration)_ | Excel export for manager reports — `app/api/manager/reports/export/route.ts` streams `getReportsData()` as 6-sheet `.xlsx`; RBAC manager/admin; 10-case integration test passes |
| 20 #28 | _(no migration)_ | Sentry error monitoring — `@sentry/nextjs` SDK via `withSentryConfig` + `sentry.{client,server}.config.ts` + `instrumentation.ts` + `app/global-error.tsx`; optional via empty `SENTRY_DSN` env vars |
| 25 | `20260908` | Email infrastructure (Phase 20 Block 3) — `email_log` table with `event_key` UNIQUE idempotency; FKs to bookings/payments/refund_requests with `ON DELETE SET NULL`; RLS staff SELECT + manager UPDATE; 5 React Email templates in `lib/email/templates/` (booking_confirmation / payment_receipt / cancellation_notice / refund_notice / checkout_thank_you); Resend client in `lib/email/resend.ts` with dev fallback + PII redaction; 7-case integration test passes |
| 19 #17 | `20260909` | `payments.amount > 0` CHECK constraint (defense-in-depth against zero-amount refund/payment rows) |
| 19 #18 | `20260910` | `confirm_refund_session` partial_refund guard (webhook preserves `payment_status='partial_refund'` instead of unconditionally clobbering to 'refunded' — action-layer override race fix) |
| 19 #19 | `20260911`, `20260912` | Multi-refund aggregation — `approve_refund` + `confirm_refund_session` SECURITY DEFINER RPCs now compute `payment_status` from `sum(approved_refunds)` vs `sum(succeeded_payments)` (`refunded` if sum >= paid, `partial_refund` if 0 < sum < paid); lock booking row to serialise concurrent approvals; `20260912` adds service_role bypass + enum cast fix-up |

**17 tables**, **11 enums**, **4 SECURITY DEFINER functions** (RLS bypass), **20+ RLS policies**

Key business rules enforced in DB:
- `bookings.chk_dates check (check_out > check_in)` (migration `20260819_bookings.sql:47`)
- `room_units.status` syncs กับ housekeeping task lifecycle (`on_task_status_change()`)
- `room_units.status='maintenance'` auto-set เมื่อ maintenance severity=critical
- `recalc_room_rating()` recompute avg/count จาก approved reviews เท่านั้น
- `reviews_guard_staff_update()` BEFORE UPDATE trigger block staff แก้ review fields
- `approve_refund(uuid)` — atomic refund decision + booking payment_status flip (Phase 19 #19: aggregates `sum(approved_refunds)` vs `sum(succeeded_payments)` for multi-refund support)
- `create_booking(uuid,uuid,date,date,...)` — atomic overbooking-prevention RPC with `PERFORM 1 ... FOR UPDATE` row lock + daterange overlap count + defense-in-depth EXCLUDE constraint
- `cancel_booking(uuid, boolean, numeric)` — atomic cancellation enforcing linked `cancellation_policy` (`free_cancel_hours` + `refund_pct`) with optional staff `refund_pct` override
- `confirm_refund_session(text, text)` — webhook-driven Stripe refund confirmation with idempotency on `provider_event_id` UNIQUE + multi-refund aggregation
- `email_log.event_key` UNIQUE — idempotency for Resend transactional emails (replay-safe)
- `bookings_no_unit_overlap` EXCLUDE — defense-in-depth overlap constraint on `(room_unit_id, daterange)` for confirmed/checked_in rows

**Documentation artifacts** (in `Y:\Final\db-schemas\`, local-only):
- `schema-documentation.docx` — Thai Word doc (17 tables + 11 enums + 4 SECURITY DEFINER functions + business triggers + RLS summary)
- `drawio-prompt.txt` — 3 formats for ER diagram (Mermaid ER / draw.io CSV / natural-language prompt)

---

## 🎨 Design System

- **Primary**: Forest Green `#082717`
- **Secondary**: Warm Gold `#765a26`
- **Tertiary**: Burgundy `#38181b`
- **Background**: Soft Cream `#faf9f6`
- **Fonts**: Playfair Display (display) + Inter (body) — via `next/font/google`
- **Icons**: Material Symbols Outlined
- **Tokens** อยู่ใน `app/globals.css` `@theme {}` block — ไม่มี `tailwind.config.ts`
  (Tailwind v4 CSS-only)

---

## ⚠️ Caveats ที่ควรรู้

1. **`USE_MOCK_DATA` module-load toggle** — เปลี่ยน env แล้วต้อง restart dev server
2. **`listCancellationPolicies`** ใน `lib/data/supabase-manager.ts:893` คืน hardcoded
   array (3 policies) — table ยังไม่ wire เข้า PostgREST
3. **`getRoomTypes` + `getFloors`** ใน `lib/data/rooms.ts:27,31` ใช้ mock เสมอ —
   ถึงแม้ `USE_MOCK_DATA=0` ก็ตาม (filter dropdown / floor dropdown break ถ้าไม่มี mock)
4. **Staff + bookings wrappers** ไม่มี mock layer — `USE_MOCK_DATA=1` โดยไม่มี
   Supabase config → throw
5. **`scripts/` excluded from project tsconfig** — relies on `npx tsx` type-strip
6. **Migrations 18–26 + 28 apply แล้วผ่าน Supabase Dashboard** (ไม่ผ่าน
   `run-migrations.mjs` filter)
7. **Test users seed via curl** (per `seed.sql`) — handle_new_user() trigger จะสร้าง
   profile row อัตโนมัติ
8. **Google OAuth requires dashboard setup** (Phase 14) — ต้อง enable Google
   provider ใน Supabase Dashboard (Authentication → Providers → Google) + paste
   OAuth Client ID/Secret จาก Google Cloud Console. ถ้าไม่ enable, login/register
   page จะแสดง error "Google OAuth ยังไม่ได้เปิดใช้งานในระบบ" แทน silent fail
9. **Phase 20 #29, #31 + Phase 19 #19 shipped (2026-09-04)** — 3 commits on `origin/main`
   (`b4b8352` rate limiting, `2b59f6a` Excel export, `23deb91` multi-refund). Token-bucket
   rate limiting throttles mutations; Excel export streams `getReportsData()` as 6-sheet
   `.xlsx`; `approve_refund` + `confirm_refund_session` now aggregate refunds vs payments
   for correct `payment_status` on multi-refund bookings.
10. **Phase 25 shipped (2026-09-04)** — Email infrastructure wired: Resend + React Email
    + 5 Thai templates + `email_log` table. Dev fallback prints redacted metadata only
    (no PII leak). Hooks in 5 server actions / webhook paths; `CheckInOutActions.tsx`
    refactored from client-side supabase update → server-action call so `checkout_thank_you`
    email can fire server-side.
11. **Phase 19 #17, #18, #19 shipped (2026-09-04)** — Tiny correctness wins:
    `payments.amount > 0` CHECK (`20260909`); `confirm_refund_session` partial_refund guard
    (`20260910`); multi-refund aggregation across both RPCs (`20260911` + `20260912`
    service_role bypass fix-up).
12. **Phase 20 #28 (Sentry) + #30 (404 stubs) shipped (2026-09-04)** — Sentry Next.js SDK
    via `withSentryConfig` (optional via empty `SENTRY_DSN`) + stub pages for
    `/privacy`, `/terms`, `/about`, `/contact`, `/careers` + branded `app/not-found.tsx`.
13. **Trigger function rewrites can silently drop columns (Phase 36.1)** — Migration
    `20260913_require_phone.sql` replaced `handle_new_user()` with a smaller body
    that lost `email` + `hired_at` columns from the INSERT. Result: every profile
    created since 20260913 had `email=NULL` even though `auth.users.email` IS
    populated for both email/password AND Google OAuth signups. **Always run
    a full backfill + sanity-check after any `CREATE OR REPLACE FUNCTION` on
    auth-related triggers** — `select count(*) filter (where p.email is null) as missing,
    count(*) filter (where p.email is distinct from au.email) as mismatched` should
    return 0,0 after backfill.
14. **Phase 37 requires "Manual Linking" toggle ON (Phase 37)** — Supabase
    Dashboard → Auth → Sign In/Up → "Allow manual linking" / "Enable Manual
    Linking" must be ON. Without it, `supabase.auth.linkIdentity()` and
    `unlinkIdentity()` server-side reject with `"Manual linking is disabled"`.
    The Phase 37 SQL helper `can_link_identity_by_email()` is defense-in-depth
    regardless — but the runtime gate is the Dashboard toggle. Verify with
    `npx tsx scripts/test-phase37-identity-linking.mts` Case 5.
15. **Phase 37 + 38 shipped (2026-09-20)** — Identity linking (link email/password
    + Google into one Supabase account) + remove User-account self-delete (Danger
    Zone removed from `/account/profile`). Local `notmain` has 2 commits
    (`b9860aa`, `9cb5376`) not yet on remote. See
    `docs/PROJECT-STATUS.md` for the today's-snapshot doc.

---

## 📜 License

Private / internal — ไม่มี LICENSE file ใน repo [ต้องยืนยัน]