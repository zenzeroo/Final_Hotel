# CLAUDE.md

AI context for Claude Code. Setup/features → [README.md](./README.md). Rules → [Rule.md](./Rule.md).

**Read first**: [AGENTS.md](./AGENTS.md) (Next.js 16 + React 19 differs from training data). Read `node_modules/next/dist/docs/` before coding.

---

## Current Status (2026-08-20)

- **Built**: 3 roles (User + Reception + Housekeeper), 22 routes
- **Planned**: Manager role (maintenance resolve flow)
- **Repo**: https://github.com/zenzeroo/Final_Hotel
- **Plan file**: `C:\Users\suns9\.claude\plans\greedy-spinning-duckling.md`

### Priority
1. ~~Housekeeper (5 pages)~~ ✅ Done
2. Manager role + maintenance resolve flow (next)
3. Image upload to R2 (`npm run images:migrate`)
4. Reviews UI (`createReview` exists, no form)
5. Forgot password
6. Email confirmation

### Test Users
- `test@zenzero.com` / `TestPass123!` — reception
- `malee@zenzero.com` / `Reception123!` — reception
- `somchai@example.com` / `UserPass123!` — user
- `somjit@zenzero.com` / `Housekeep123!` — housekeeper (u-house-1)
- `niran@zenzero.com` / `Housekeep123!` — housekeeper (u-house-2)

---

## Tech Stack

- Next.js 16.3 App Router + TS strict + React 19.2 (async `params`/`searchParams`)
- Tailwind 4.3 — CSS-based `@theme` in `app/globals.css`. **No `tailwind.config.ts`**
- Supabase (Postgres + Auth + RLS), singleton at `lib/supabase/server.ts`
- Cloudflare R2 — URLs via `lib/r2/publicUrl.ts`
- Next.js 16 Proxy at root (`proxy.ts`) — **not `middleware.ts`**

---

## Data Layer (`lib/data/`)

- Toggle: `USE_MOCK_DATA` env var
- `rooms.ts` — public: `getFeaturedRooms`, `getRoomBySlug`, `searchRooms`
- `mock-rooms.ts` — reads `data/mock-rooms.json`
- `supabase-rooms.ts` — queries `room_types`
- `bookings.ts` — user-scoped: `getUserBookings`, `getBookingById`, `getDefaultCancellationPolicy`
- `staff.ts` — staff queries (RLS-enforced, **no service role**)

---

## Server Actions (`app/actions/`)

- `auth.ts` — `signIn`, `signUp`, `signOut`
- `booking.ts` — `createBooking`, `cancelBooking`, `markPaid`, `createReview`
- Preferred mutation path
- Direct client-side Supabase = **staff quick actions only**

---

## Routes

- Public: `app/page.tsx`, `app/rooms/*`
- Public auth: `app/(auth)/login`, `app/(auth)/register` — redirects authed → `/`
- Protected: `app/(booking)/bookings/*` (any authed user)
- Staff: `app/reception/*` (role: reception/admin)
- `app/(booking)/bookings/new` uses `getRoomById` (not `getRoomBySlug`)

---

## Booking Flow

1. `/rooms/[slug]` → `BookingWidget` (Client) → `/bookings/new?roomId=&checkIn=&checkOut=&guests=`
2. `/bookings/new` — Server Component pre-fills from `getSession()` + room + cancellation policy
3. `BookingForm` → `createBooking` (Zod validate + promotion lookup + `lib/pricing.ts`)
4. Redirect → `/bookings/[id]`

---

## Pricing (`lib/pricing.ts`)

- `calculateNights(checkIn, checkOut)` — date-fns `differenceInCalendarDays`
- `calculatePrice({ basePrice, checkIn, checkOut, promotion })` → `{ nights, baseSubtotal, discountTotal, taxTotal, feeTotal, total }`
- Tax: 7% of (subtotal − discount); Resort fee: 150/night (env)
- Currency: THB

---

## Role-Based Access (`proxy.ts`)

Runs on every request (config.matcher):
1. Refresh Supabase cookie via `updateSession()`
2. Protected (`/bookings`, `/account`, `/reception`, `/housekeeper`): unauthed → `/login?next=...`
3. Staff (`/reception`, `/housekeeper`): role check → else `/`
4. Auth pages: authed → `/`
5. Server components re-check via `getSession()` (proxy is best-effort)

---

## Design System

- Colors: Forest Green `#082717`, Warm Gold `#765a26`, Soft Cream `#faf9f6`
- Fonts: Playfair Display (display) + Inter (body) — `next/font/google`
- Tokens: CSS `@theme {}` in `app/globals.css`
- Icons: Material Symbols Outlined via `components/ui/MaterialIcon.tsx`

---

## Supabase

### Connection
- App: anon key via `NEXT_PUBLIC_*`
- Server actions: anon key + cookies (RLS)
- Migrations (`scripts/run-sql.mjs`): Pooler `aws-0-ap-southeast-1.pooler.supabase.com:6543` (port 5432 often blocked)
- Needs `SUPABASE_DB_PASSWORD` (**not** service role key)

### Migration Order
`20260818_init` → `_rls` → `20260819_room_types` (+ `_rls`) → `20260819_bookings` (+ `_rls`) → `20260820_staff_role` (+ `_rls`) → `20260820_fix_rls_recursion`. See `supabase/migrations/` for filenames.

### RLS Helpers
- `public.is_staff()` — reception/housekeeper/admin (SECURITY DEFINER)
- `public.has_role(text)` — specific role check

**Always use** in policies. **Never query `profiles` in subquery** → infinite recursion (42P17).

### RLS Patterns
- Public read: `room_types`, `amenities`, `promotions`, `cancellation_policies`
- Self only: `bookings`, `reviews`, `profiles`
- Staff read all / write: `bookings`, `profiles`, `room_units`, `guest_notes`, `booking_events` — use `is_staff()`
- `TO authenticated` + ownership in `USING` (not `auth.role()`)
- UPDATE: needs `USING` + `WITH CHECK`
- `(select auth.uid())` (subquery) — allows RLS caching

---

## Common Pitfalls

**Per Rule R1**: log solved non-trivial bugs here.

- `params` / `searchParams` = **Promises** → `await props.params`
- Use `PageProps<'/route'>` / `LayoutProps<'/route'>` (auto-generated)
- Pages fetching user data → `export const dynamic = 'force-dynamic'` (avoid build prerender failures)
- `cookies()` is async → `await cookies()`
- **No `middleware.ts`** → use `proxy.ts`
- **No `tailwind.config.ts`** → Tailwind v4 CSS-only
- **No `profiles` in RLS subquery** → use `is_staff()` (42P17 recursion)
- **RLS infinite recursion (42P17)** — fixed via `20260820_fix_rls_recursion.sql`

---

## Promote User to Staff

```sql
UPDATE profiles SET role='reception' WHERE id='<uuid>';
```

---

## Project Structure (AI-relevant)

```
app/        (auth) | (booking) | page.tsx | rooms | reception | actions
components/ layout (TopNavBar, Footer, StaffSidebar) | room (BookingWidget) | search | ui | feedback | landing
lib/        data | supabase | pricing.ts | dates.ts
supabase/   migrations | seed*.sql
scripts/    run-sql.mjs | migrate-images.mjs | migration-config.json
data/       mock-rooms.json | mock-amenities.json
proxy.ts
```

---

## Known Gaps

- Housekeeper role (5 pages) — not built
- Reviews UI — action exists, no form
- Forgot password — no flow
- Email confirmation — auto-login on register
- Image upload to R2 — script ready, not run