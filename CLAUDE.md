# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **CRITICAL**: Read [AGENTS.md](./AGENTS.md) first. This is Next.js 16 with React 19 — APIs and conventions differ from your training data. Read `node_modules/next/dist/docs/` before writing code.

## What This Project Is

**Zenzero Hotel** — a full-stack hotel management system. Two roles built: **User** (customer) and **Reception** (booking staff). Housekeeper role is **planned but not yet built** (5 pages missing). Started as static HTML prototypes (in `Y:/Final/V1_Prototype/extracted/`), then built into this Next.js app with Supabase + Cloudflare R2.

**Project path**: `Y:\Final\final\` (after merge from `final-user-ui` → `final-user-booking` → `final`).

## Tech Stack (Quick Reference)

- **Next.js 16.3** App Router + **TypeScript** (strict)
- **React 19.2** (canary features, async `params`/`searchParams`)
- **Tailwind CSS 4.3** (CSS-based `@theme` config in `app/globals.css` — **no `tailwind.config.ts`**)
- **Supabase** — Postgres + Auth + RLS (text data, all policies on every table)
- **Cloudflare R2** — S3-compatible, stores room images. R2 keys stored in DB, URLs built via `lib/r2/publicUrl.ts`
- **Next.js 16 Proxy** (`proxy.ts` at root) — replaces `middleware.ts`. Refreshes Supabase cookie + enforces role-based access.

## Common Commands

```bash
npm run dev                # Dev server (port 3000)
npm run build              # Production build
npm run lint               # ESLint
npm run typecheck          # tsc --noEmit
npm run images:migrate     # Upload prototype images to R2 (needs R2 keys)
node scripts/run-sql.mjs supabase/migrations/<file>.sql  # Run SQL via Pooler (needs SUPABASE_DB_PASSWORD)
```

To read the bundled Next.js 16 docs:
```
node_modules/next/dist/docs/01-app/01-getting-started/
```

## High-Level Architecture

### Data Layer (`lib/data/`)
Single interface with **toggle** between mock and Supabase implementations, controlled by `USE_MOCK_DATA` env var.

- `lib/data/rooms.ts` — public interface (`getFeaturedRooms`, `getRoomBySlug`, `searchRooms`)
- `lib/data/mock-rooms.ts` — reads from `data/mock-rooms.json`
- `lib/data/supabase-rooms.ts` — queries `room_types` table
- `lib/data/bookings.ts` — user-scoped bookings (`getUserBookings`, `getBookingById`, `getDefaultCancellationPolicy`)
- `lib/data/staff.ts` — staff queries (`getAllBookings`, `getTodayStats`, `getRecentBookings`, `getRoomsStatus`, `searchCustomers`, `getRecentEvents`)

**Pattern**: All Supabase queries use the singleton server client from `lib/supabase/server.ts`. The staff functions rely on RLS policies (not service role) to enforce read/write permissions.

### Server Actions (`app/actions/`)
- `auth.ts` — `signIn`, `signUp`, `signOut`
- `booking.ts` — `createBooking`, `cancelBooking`, `markPaid`, `createReview` (no UI for review yet)

Server actions are the **preferred** mutation path (form actions or `useActionState`). Direct client-side Supabase updates are used **only for staff** quick actions (e.g. check-in button on `/reception/check-in-out`) — staff actions are explicitly allowed by RLS and faster UX.

### Route Structure
- `app/page.tsx`, `app/rooms/page.tsx`, `app/rooms/[id]/page.tsx` — public
- `app/(auth)/login`, `app/(auth)/register` — public, redirects authed users to `/`
- `app/(booking)/bookings/*` — protected by proxy (any authed user)
- `app/reception/*` — protected by proxy, requires `role IN ('reception','admin')`
- `app/(booking)/bookings/new` uses `getRoomById` (helper in same dir), not `getRoomBySlug`

### Booking Flow
1. Browse `/rooms/[slug]` → `BookingWidget` (Client) with date picker + price calc → `/bookings/new?roomId=...&checkIn=...&checkOut=...&guests=...`
2. `/bookings/new` — Server Component pre-fills from `getSession()`, pre-fetches room + cancellation policy
3. `BookingForm` (Client) calls `createBooking` server action
4. Server action validates (Zod), looks up promotion if any, calculates price via `lib/pricing.ts`, inserts booking
5. Redirect to `/bookings/[id]`

### Pricing (`lib/pricing.ts`)
- `calculateNights(checkIn, checkOut)` — date-fns `differenceInCalendarDays`
- `calculatePrice({ basePrice, checkIn, checkOut, promotion })` — returns `{ nights, baseSubtotal, discountTotal, taxTotal, feeTotal, total }`
- Tax rate: 7% of (subtotal − discount), resort fee: 150/night — read from env
- Currency: THB

### Role-Based Access
**`proxy.ts`** (root) runs on every request matching `config.matcher`:
1. Refresh Supabase auth cookie via `updateSession()`
2. **Protected paths** (`/bookings`, `/account`, `/reception`, `/housekeeper`): redirect unauthed → `/login?next=...`
3. **Staff paths** (`/reception`, `/housekeeper`): require `profiles.role` in allowed set, else redirect to `/`
4. **Auth pages** (`/login`, `/register`): redirect authed users to `/`

Server-side components re-check via `getSession()` since proxy is best-effort.

### Design System
- Colors: Forest Green `#082717` (primary), Warm Gold `#765a26` (secondary), Soft Cream `#faf9f6` (background)
- Fonts: Playfair Display (display), Inter (body) — via `next/font/google`
- **All design tokens are CSS-based** in `app/globals.css` via `@theme {}` — DO NOT create a `tailwind.config.ts` file
- Material Symbols Outlined icons — wrapped in `components/ui/MaterialIcon.tsx`

## Supabase

### Connection
- **App-side**: anon key via `NEXT_PUBLIC_*` env vars
- **Server actions**: anon key with cookies (RLS-enforced)
- **Migrations** (`scripts/run-sql.mjs`): uses **Supabase Pooler** at `aws-0-ap-southeast-1.pooler.supabase.com:6543` (port 5432 is blocked in many networks). Requires `SUPABASE_DB_PASSWORD` (not service role key).

### Migrations (8 + 1 fix)
Run in this order:
1. `20260818_init.sql` + `20260818_rls.sql` — profiles + auth trigger
2. `20260819_room_types.sql` + `20260819_room_types_rls.sql` — room catalog
3. `20260819_bookings.sql` + `20260819_bookings_rls.sql` — bookings, reviews, policies
4. `20260820_staff_role.sql` + `20260820_staff_rls.sql` — role, room_units, booking_events, guest_notes
5. `20260820_fix_rls_recursion.sql` — **CRITICAL** fix for infinite recursion in profiles RLS

### RLS Helper Functions (created by fix migration)
- `public.is_staff()` — returns true if user is reception/housekeeper/admin (SECURITY DEFINER, bypasses RLS)
- `public.has_role(text)` — returns true if user has specific role

**Always use these functions** in RLS policies that need to check role — never query `profiles` table directly in a policy subquery (causes infinite recursion).

### RLS Patterns
- **Public read** for `room_types`, `amenities`, `promotions`, `cancellation_policies` (anon + authenticated)
- **Self only** for `bookings`, `reviews`, `profiles` (user can only see own)
- **Staff read all / write** for `bookings`, `profiles`, `room_units`, `guest_notes`, `booking_events` — use `is_staff()` in policy
- Use `TO authenticated` + ownership predicate in `USING` (not `auth.role()`)
- UPDATE policies need both `USING` and `WITH CHECK`
- Use `(select auth.uid())` (subquery) to allow RLS to be cached

### Test Users
- `test@zenzero.com` / `TestPass123!` — reception
- `malee@zenzero.com` / `Reception123!` — reception
- `somchai@example.com` / `UserPass123!` — user

Promote a user to staff: `UPDATE profiles SET role='reception' WHERE id='<uuid>';`

## Common Pitfalls (Next.js 16)

- `params` and `searchParams` are now **Promises** — always `await props.params` / `await props.searchParams`
- Use `PageProps<'/route'>` and `LayoutProps<'/route'>` (global types, generated by `next dev`/`next build`/`next typegen`)
- For pages that fetch user data: add `export const dynamic = 'force-dynamic'` to prevent build-time prerender failures
- `cookies()` is async — always `await cookies()` in server code
- Do NOT use `middleware.ts` — use `proxy.ts` at root instead
- Do NOT create `tailwind.config.ts` — Tailwind v4 uses CSS-only config
- **Do NOT query `profiles` in RLS subquery** — causes infinite recursion (42P17). Use `is_staff()` function instead

## Project Structure (Big Picture)

```
app/
  (auth)/            # Login/Register (public)
  (booking)/         # /bookings/* (authed users)
  page.tsx           # Home (public)
  rooms/             # Search + Detail (public)
  reception/         # /reception/* (role: reception/admin)
  actions/           # Server actions (auth, booking)
components/
  layout/            # TopNavBar, Footer, ScrollNavIsland, StaffSidebar, TransactionalHeader
  room/              # RoomCard, BookingWidget, RoomGallery, AmenityCard/Grid, RatingStars
  search/            # SearchBar, FilterSidebar, FilterChips, SearchSummaryCard
  ui/                # Button, MaterialIcon, Card
  feedback/          # EmptyState
  landing/           # HeroSection
lib/
  data/              # Toggle between mock/Supabase
  supabase/          # server.ts, client.ts, proxy.ts, getSession.ts
  pricing.ts         # calculateNights, calculatePrice
  dates.ts           # formatDate, formatDateTime
supabase/
  migrations/        # Numbered SQL files (8 + 1 fix)
  seed*.sql          # Test data
scripts/
  run-sql.mjs        # Run SQL via Supabase Pooler
  migrate-images.mjs # Upload prototype images to R2
  migration-config.json
data/
  mock-rooms.json    # 10 rooms
  mock-amenities.json # 8 amenities
proxy.ts             # Next.js 16 Proxy (root)
```

## Known Gaps (Future Work)

- **Phase 5: Housekeeper role** (5 pages) — planned, not built. See `app/housekeeper/` would be added.
- **Reviews UI** — `createReview` action exists but no write modal.
- **Forgot password** — no flow yet.
- **Email confirmation** — currently auto-login on register.
- **Image upload to R2** — script ready (`npm run images:migrate`), not yet run.

For full project overview and setup, see [README.md](./README.md).
