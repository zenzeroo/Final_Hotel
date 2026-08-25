# Zenzero Hotel

Full-stack hotel management system — Next.js 16 + Supabase + Cloudflare R2.

4 roles: **User**, **Reception**, **Housekeeper**, **Manager**, **Admin**.

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure env (copy .env.example → .env.local)
cp .env.example .env.local
# Edit .env.local with your Supabase + R2 credentials.

# 3. Apply migrations
node scripts/run-migrations.mjs --only=20260833      # apply all pending migrations

# 4. Seed (optional — only against a fresh DB)
# Run supabase/seed.sql via Supabase dashboard or psql

# 5. Run dev server
npm run dev                # http://localhost:3000
```

### Test Users (after seed)
```
admin@zenzero.com      / AdminPass123!       — admin
manager@zenzero.com    / ManagerPass123!     — manager
reception@zenzero.com  / ReceptionPass123!   — reception
housekeeper@zenzero.com / HousekeeperPass123! — housekeeper
user1@zenzero.com      / UserPass123!        — user
```

## Commands

```bash
npm run dev                # Dev server (port 3000)
npm run build              # Production build
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit

# Database
node scripts/run-migrations.mjs                       # Apply all pending migrations
node scripts/run-migrations.mjs --only=20260833      # Apply specific migration

# Live-DB smoke tests
npx tsx scripts/test-phase10-kpi-trend.mts           # Phase 10 KPI accuracy test
npx tsx scripts/test-phase10-refund-rpc.mts          # Phase 10 refund RPC test
npx tsx scripts/_cleanup-test-rows.mts                # Cleanup leaked test bookings

# Docs
node_modules/next/dist/docs/01-app/01-getting-started/   # Bundled Next.js 16 docs
```

## Architecture

### Data Layer (`lib/data/`)
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

**Important**: `useMock` flag evaluates at **module load time** — toggling `USE_MOCK_DATA` requires dev server restart.

### Route Structure
```
app/
  (auth)/login, (auth)/register   # public
  (public)/                       # home, rooms (public)
  (booking)/bookings/             # authed users
  reception/                      # role: reception/admin
  housekeeper/                    # role: housekeeper/admin
  manager/                        # role: manager/admin (dashboard, reports, refunds, housekeeping)
  admin/                          # role: admin only (CRUD pages)
  actions/                        # server actions
```

### Role-Based Access (`proxy.ts`)
Root-level `proxy.ts` (Next.js 16 Proxy — replaces `middleware.ts`):
1. Refresh Supabase auth cookie via `updateSession()`
2. Protected paths redirect unauthed → `/login?next=...`
3. Staff paths require role match, else redirect `/`
4. Auth pages redirect authed users → `/`

## Database

Migrations in `supabase/migrations/` (20260818 → 20260833), applied via `scripts/run-migrations.mjs`.

Local archive at `Y:\Final\db-schemas\` (since `supabase/` is gitignored).

### Key Patterns

- **RLS** on every table — public/self/staff policies per row
- **`is_st Staff()` / `has_role(text)` SECURITY DEFINER helpers** — avoid inline `EXISTS` on `profiles` (causes 42P17 recursion)
- **SECURITY DEFINER RPCs** for atomic cross-table updates (e.g. `approve_refund(uuid)`)
- **Use `(select auth.uid())` subquery** in policies — allows RLS caching
- **UPDATE policies need both `USING` and `WITH CHECK`** clauses

## Tech Stack

- **Next.js 16.3** App Router + **TypeScript** strict
- **React 19.2** (async `params`/`searchParams`, `PageProps<'/route'>` types)
- **Tailwind CSS 4.3** — CSS-only `@theme {}` config in `app/globals.css` (no `tailwind.config.ts`)
- **Supabase** — Postgres + Auth + RLS
- **Cloudflare R2** — S3-compatible image storage via `lib/r2/publicUrl.ts`

## Conventions

- Server actions are the **preferred mutation path** (form actions or `useActionState`). Direct client-side Supabase updates used **only for staff** quick actions (e.g. check-in button on `/reception/check-in-out`) — staff actions are explicitly allowed by RLS.
- Pages that fetch user data must have `export const dynamic = 'force-dynamic'`
- All design tokens are CSS-based in `app/globals.css` via `@theme {}`
- Use `proxy.ts` at root (Next.js 16) — never `middleware.ts`
- Use `PageProps<'/route'>` and `LayoutProps<'/route'>` (global types from `next typegen`)

## Local-Only Files

These stay in working tree only — never push to remote:

```
/README.md
/CLAUDE.md
/AGENTS.md
/Rule.md
/docs/
/.env*
/supabase/migrations/
/supabase/seed.sql
/supabase/seed_housekeeping.sql
.dev-server*.log
/supabase/.temp/
```

DB schema files are mirrored at `Y:\Final\db-schemas\` outside the working tree.

## Contribution Rules (R1 + R2)

**R1 — Document Solved Problems**: When you fix a non-trivial bug/quirk, add a bullet to `CLAUDE.md → ## Common Pitfalls`. Format:
```
- **<short name>** — <symptom> → <fix + reason>
```

**R2 — Ask Before Commit/Push**: Always ask user approval before `git commit` or `git push`. Show diff stat + commit message before committing, specify branch before pushing. Exception: user explicitly says "commit แล้ว push" with message/branch in the same instruction.

See `Rule.md` for full rules.