# Zenzero Hotel

> **Full-stack hotel management system** — booking, operations, and back-office
> in one Next.js 16 app with Supabase (Postgres + Auth + RLS) and Cloudflare R2.

5 role tiers — **Customer**, **Reception**, **Housekeeper**, **Manager**, **Admin** —
each with their own dashboards, permissions, and server actions.

Originally prototyped as static HTML at `Y:/Final/V1_Prototype/extracted/`, then
rebuilt into a typed Next.js + Supabase app across 15 phases.

---

## ✨ Features ที่เด่น

- **Role-based access control** ผ่าน Next.js 16 `proxy.ts` + per-role layout
  re-checks (defense-in-depth) — 5 roles แต่ละ role gate ทั้ง 2 layer, single
  source of truth คือ `roleHomePath()` ใน `lib/supabase/getSession.ts` (Phase 11)
- **Atomic refund approval** ผ่าน `approve_refund(uuid)` SECURITY DEFINER RPC
  (Phase 10) — flip `refund_requests.status='approved'` และ
  `bookings.payment_status='refunded'` ใน transaction เดียว พร้อม double-decision guard
- **Seasonal pricing engine** (Phase 8) — `quoteStay()` รวม seasonal rate overrides,
  `min_nights_override`, คำนวณ baseSubtotal + discount + tax (7%) + resort fee (150 THB/night)
- **Live availability + room status** — `room_units` พร้อม status enum
  (`available, occupied, cleaning, maintenance, out_of_order`),
  trigger `on_task_status_change()` sync กับ housekeeping task lifecycle
- **Review moderation** พร้อม staff guard trigger — staff แก้ review ได้เฉพาะ
  `status/moderated_by/moderated_at`, แตะ field อื่นโดน `reviews_guard_staff_update()` block
- **Cloudflare R2 image storage** — room images เก็บใน R2, URLs build
  ผ่าน `lib/r2/publicUrl.ts`
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
- `/admin/rates/room-types` (+ `new`, `[id]/edit`) — CRUD room types
- `/admin/rates/seasonal-rates` (+ `new`, `[id]/edit`) — CRUD seasonal rates

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
# Apply ทุก pending migrations (filtered to 202608(27|29|30|31|32|33|34))
node scripts/run-migrations.mjs

# Apply migration เดียว
node scripts/run-migrations.mjs --only=20260833

# Dry-run ดูว่าจะ apply อะไร
node scripts/run-migrations.mjs --dry-run
```

**Migration filter ปัจจุบัน** (`scripts/run-migrations.mjs:54`):
`/202608(27|29|30|31|32|33|34)_.*\.sql$/` — migrations 18–26 และ 28 apply ผ่าน
Supabase Dashboard SQL editor ไปแล้ว

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
npx tsx scripts/test-phase11-rbac.mts          # Phase 11 — RBAC redirect matrix (48/48)
npx tsx scripts/_rbac-fixture.mts              # Reset test user roles (idempotent)
npx tsx scripts/test-phase10-kpi-trend.mts     # Phase 10 — KPI accuracy
npx tsx scripts/test-phase10-refund-rpc.mts    # Phase 10 — refund RPC
npx tsx scripts/_cleanup-test-rows.mts         # Cleanup leaked test bookings
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
│   ├── migrations/            # 24 numbered SQL files (20260818_*.sql → 20260833_*.sql)
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

24 migrations, Phase 1 → Phase 12 (full detail ใน `db-schemas/`):
- **Phase 11**: ไม่มี migration ใหม่ — RBAC code-only fix (proxy.ts + layout + signIn)
- **Phase 12**: `20260834` (bookings.channel + bookings.room_unit_id) — รองรับ walk-in booking + room assignment ตอน check-in
- **Phase 14**: ไม่มี migration ใหม่ — Google OAuth code-only (Supabase hosted flow + error surfacing)
- **Phase 15**: ไม่มี migration — DB documentation (Word + draw.io prompt ใน `Y:\Final\db-schemas\`)

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

**17 tables**, **11 enums**, **4 SECURITY DEFINER functions** (RLS bypass), **20+ RLS policies**

Key business rules enforced in DB:
- `bookings.chk_dates check (check_out > check_in)` (migration `20260819_bookings.sql:47`)
- `room_units.status` syncs กับ housekeeping task lifecycle (`on_task_status_change()`)
- `room_units.status='maintenance'` auto-set เมื่อ maintenance severity=critical
- `recalc_room_rating()` recompute avg/count จาก approved reviews เท่านั้น
- `reviews_guard_staff_update()` BEFORE UPDATE trigger block staff แก้ review fields
- `approve_refund(uuid)` — atomic refund decision + booking payment_status flip

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

---

## 📜 License

Private / internal — ไม่มี LICENSE file ใน repo [ต้องยืนยัน]