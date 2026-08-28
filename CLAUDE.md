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

**Current HEAD**: `56d09ca` on `main` (synced with `origin/main`)

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