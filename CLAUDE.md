<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Rules (Claude Code — read before acting)

กฎเหล่านี้บังคับใช้ทุก session ในโปรเจกต์นี้ รายละเอียดเต็มอยู่ใน `Rule.md` ที่ root

## R1 — Document Solved Problems

เมื่อเจอ bug / error / unexpected behavior แล้วแก้ได้สำเร็จ ต้องเพิ่ม bullet ลง `## Common Pitfalls` ทันที — format:

```
- **<ชื่อปัญหาสั้นๆ>** — <อาการ/Error> → <วิธีแก้ + เหตุผล>
```

อย่าบันทึก error ที่แก้ง่าย (typo, missing import) หรือ one-off issue ที่ไม่กระทบ pattern

## R2 — Ask Before Git Commit / Push

ทุกครั้งที่จะ `git commit` หรือ `git push` ต้องถาม user ให้อนุมัติก่อนเสมอ — ห้ามทำเองโดยไม่ได้รับ explicit approval

- ก่อน commit: รวบรวมไฟล์ + แสดง diff stat + commit message → ถาม "OK to commit?"
- ก่อน push: ระบุ branch ปลายทาง → ถาม "OK to push to <remote>/<branch>?"

Exception: user ระบุ "commit แล้ว push" พร้อม message/branch ในคำสั่งเดียว → ทำได้ทันที

---

# What This Project Is

**Zenzero Hotel** — full-stack hotel management system, พัฒนาต่อจาก prototype ที่ `Y:/Final/V1_Prototype/`

4 roles:
- **User** (customer) — browse/จอง/รีวิว
- **Reception** (booking staff) — check-in/out, bookings, guest notes
- **Housekeeper** (cleaning staff) — housekeeping tasks, maintenance reports
- **Manager** — oversight, refund approvals, reports dashboard
- **Admin** — full access + staff/promotions/rates CRUD

# Tech Stack

- **Next.js 16.3** App Router + **TypeScript** (strict) — `proxy.ts` ไม่ใช่ `middleware.ts`
- **React 19.2** — async `params`/`searchParams`, `PageProps<'/route'>` types
- **Tailwind CSS 4.3** — CSS-only `@theme {}` config in `app/globals.css` (no `tailwind.config.ts`)
- **Supabase** — Postgres + Auth + RLS. Policies on every table.
- **Cloudflare R2** — S3-compatible image storage. URLs via `lib/r2/publicUrl.ts`
- **SECURITY DEFINER RPCs** — for atomic multi-table updates + RLS bypass (e.g. `approve_refund`)

# Common Commands

```bash
npm run dev                # Dev server (port 3000)
npm run build              # Production build
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit

# Database
node scripts/run-migrations.mjs --only=20260833      # Apply specific migration
node scripts/run-migrations.mjs                       # Apply all pending migrations

# Tests
npx tsx scripts/test-phase10-kpi-trend.mts           # Phase 10 KPI test
npx tsx scripts/test-phase10-refund-rpc.mts          # Phase 10 refund RPC test
npx tsx scripts/_cleanup-test-rows.mts                # Cleanup leaked test bookings

# Docs
node_modules/next/dist/docs/01-app/01-getting-started/  # bundled Next.js 16 docs
```

# Architecture

## Data Layer (`lib/data/`)
Single interface with **toggle** between mock + Supabase, controlled by `USE_MOCK_DATA` env var:

```
lib/data/
  manager.ts        # getManagerDashboardStats, getReportsData, approveRefund, ...
  admin.ts          # Admin CRUD (promotions, staff, seasonal rates, settings)
  rooms.ts          # public rooms (getFeaturedRooms, getRoomBySlug, searchRooms)
  bookings.ts       # user-scoped bookings
  reviews.ts        # public reviews
  staff.ts          # staff queries
  mock-*.ts         # in-memory state (only used when USE_MOCK_DATA=1)
  supabase-*.ts     # live PostgREST queries (RLS-enforced)
```

**Important**: `useMock` flag evaluates at **module load time** — see Pitfalls §5.

## Server Actions (`app/actions/`)
- `auth.ts` — `signIn`, `signUp`, `signOut`
- `booking.ts` — `createBooking`, `cancelBooking`, `markPaid`, `createReview`
- `manager.ts` — `resolveDamageReportAction`, `approveRefundAction`, `rejectRefundAction`
- `admin/*.ts` — `createStaffAction`, `createPromotionAction`, ...

## Route Structure
```
app/
  (auth)/login, (auth)/register   # public, redirects authed users
  (public)/                       # home, rooms (public)
  (booking)/bookings/             # authed users
  reception/                      # role: reception/admin
  housekeeper/                    # role: housekeeper/admin
  manager/                        # role: manager/admin (dashboard, reports, refunds)
  admin/                          # role: admin only (CRUD pages)
  actions/                        # server actions
```

## Role-Based Access (`proxy.ts`)
1. Refresh Supabase auth cookie via `updateSession()`
2. Protected paths (`/bookings`, `/account`, `/reception`, `/housekeeper`, `/manager`, `/admin`) redirect unauthed → `/login?next=...`
3. Staff paths (`/reception`, `/housekeeper`, `/manager`) require role match, else redirect `/`
4. Auth pages redirect authed users → `/`

Server components re-check via `getSession()` (proxy is best-effort).

# Supabase

## Migrations
Run numbered migrations in `supabase/migrations/` (20260818 → ...). Archived locally at `Y:\Final\db-schemas\`. Apply via `node scripts/run-migrations.mjs --only=<migration_id>`.

When creating new migrations:
- Number with `YYYYMMDD_NN_<topic>.sql` format
- Copy to `Y:\Final\db-schemas\` after applying (per local-only convention)
- Add to filter regex in `scripts/run-migrations.mjs`

## RLS Patterns
- **Public read** for `room_types`, `amenities`, `promotions`, `cancellation_policies`
- **Self only** for `bookings`, `reviews`, `profiles`
- **Staff** (manager/admin/reception/housekeeper) read all + write via `is_staff()` / `has_role()` helpers
- **SECURITY DEFINER RPCs** for atomic cross-table updates (see §6)

Use `TO authenticated` + `(select auth.uid())` subquery (allows RLS caching). UPDATE policies need both `USING` and `WITH CHECK`.

## Test Users (seeded)
```
admin@zenzero.com    / AdminPass123!     — admin (full access)
manager@zenzero.com  / ManagerPass123!   — manager
reception@zenzero.com / ReceptionPass123! — reception
housekeeper@zenzero.com / HousekeeperPass123! — housekeeper
user1@zenzero.com    / UserPass123!      — user
```

Promote: `UPDATE profiles SET role='<role>' WHERE email='<email>';`

# Common Pitfalls (Next.js 16 + Zenzero-specific)

## Next.js 16 conventions
- `params` and `searchParams` are **Promises** — always `await props.params` / `await props.searchParams`
- Use `PageProps<'/route'>` and `LayoutProps<'/route'>` (global types, generated by `next dev`/`next build`/`next typegen`)
- For pages that fetch user data: add `export const dynamic = 'force-dynamic'` to prevent build-time prerender failures
- `cookies()` is async — always `await cookies()` in server code
- Do NOT use `middleware.ts` — use `proxy.ts` at root instead
- Do NOT create `tailwind.config.ts` — Tailwind v4 uses CSS-only config

## Zenzero-specific

- **RLS infinite recursion (42P17)** — profiles/room_types policies ห้ามใช้ inline `EXISTS` on `profiles` → ใช้ `is_staff()` / `has_role(text)` SECURITY DEFINER helpers แทน (helper defined ใน migration `20260820_staff_rls.sql`)

- **listStub pitfall** — wiring dispatcher (เช่น เพิ่ม export ใน `lib/data/manager.ts`) ไม่พอ — ต้องตรวจ `lib/data/supabase-*.ts` ว่า function นั้น implement จริง ไม่ใช่ return `[]` stub อยู่

- **Next.js 16 server action HTTP test** — POST server action ผ่าน HTTP ต้องใช้ field `$ACTION_ID_<id>` ใน multipart body (ไม่ใช่ `Next-Action` header เหมือนเวอร์ชั่นก่อนหน้า)

- **SSR HTML comment split** — React SSR แทรก HTML comment ระหว่าง text nodes, e.g. `+<!-- -->12.5<!-- -->%` — regex parse ตัวเลขจาก SSR HTML ต้อง `.replace(/<!--[^>]*-->/g, '')` ก่อน match

- **USE_MOCK_DATA wrapper** — `lib/data/*.ts` evaluate `useMock` at module load. แก้ `.env.local` แล้ว **ต้อง restart `npm run dev`** ไม่งั้น action calls ทุกตัวยังไป mock-manager.ts (in-memory state, no DB writes) — symptom: HTTP 200 success + ไม่มี DB change

- **Admin RLS blocks DELETE on bookings** — admin user มีแค่ UPDATE grant (staff policy), ไม่มี DELETE → cleanup test rows ด้วย admin client จะ silent fail (error=null แต่ row ยังอยู่). ใช้ `SUPABASE_SERVICE_ROLE_KEY` createServiceClient แทนสำหรับ DELETE step

- **`proxy.ts` (Next.js 16 Proxy)** ไม่ใช่ `middleware.ts` — convention เปลี่ยน, files ใน `middleware.ts` ที่ training data คุ้นไม่มีใน project นี้

---

# Project Structure (Big Picture)

```
app/
  (auth)/           # Login/Register (public)
  (public)/         # Home, Rooms (public)
  (booking)/        # /bookings/* (authed users)
  reception/        # /reception/* (role: reception/admin)
  housekeeper/      # /housekeeper/* (role: housekeeper/admin)
  manager/          # /manager/* (role: manager/admin) — dashboard, reports, refunds, housekeeping
  admin/            # /admin/* (role: admin only) — CRUD pages
  actions/          # Server actions (auth.ts, booking.ts, manager.ts, admin/*.ts)
components/
  layout/           # TopNavBar, Footer, StaffSidebar, ManagerSidebar, AdminSidebar
  room/             # RoomCard, BookingWidget, RoomGallery, AmenityCard/Grid
  search/           # SearchBar, FilterSidebar, FilterChips, SearchSummaryCard
  ui/               # Button, MaterialIcon, Card, Badge, EmptyState, StatCard
  feedback/         # EmptyState
  review/           # StarRating, ReviewList, ReviewForm
lib/
  data/             # Toggle between mock/Supabase (manager.ts, admin.ts, rooms.ts, ...)
  supabase/         # server.ts, client.ts, proxy.ts, getSession.ts
  pricing.ts        # calculateNights, calculatePrice
  dates.ts          # formatDate, formatDateTime
  r2/               # publicUrl.ts (R2 image URL builder)
supabase/
  migrations/       # Numbered SQL files (20260818_* → 20260833_*)
  seed*.sql         # Test data (in .gitignore — see Y:\Final\db-schemas\)
scripts/
  run-migrations.mjs          # Apply migrations via Supabase Pooler
  test-phase*-*.mts           # Live-DB smoke tests (mirror Phase 9 + 10 pattern)
  _cleanup-test-rows.mts      # Service-role DELETE for leaked test rows
proxy.ts                      # Next.js 16 Proxy (root) — role-based redirects
docs/                         # Phase notes, design notes (in .gitignore)
data/                         # Mock JSON files (rooms, amenities)
```

For full setup + test credentials, see [README.md](./README.md).