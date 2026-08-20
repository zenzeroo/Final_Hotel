# Zenzero Hotel

A full-stack hotel management system built with Next.js 16, Supabase, and Cloudflare R2.

## Tech Stack

- **Frontend & Backend**: Next.js 16 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **File Storage**: Cloudflare R2 (S3-compatible)
- **Styling**: Tailwind CSS v4 (design tokens)
- **Auth**: Supabase Auth with role-based access (user / reception / housekeeper / admin)

## Features

### User (Customer)
- Browse rooms with search & filter
- View room details
- Book rooms with dynamic pricing
- Manage bookings (view, cancel, review)
- Authentication (login / register)

### Reception
- Dashboard with today's check-ins/outs
- Booking management (filter, search, cancel)
- Walk-in booking
- Check-in / check-out
- Customer search
- Guest requests & notes
- Room status management
- Action history audit log

### Housekeeper
- Dashboard with shift progress
- Room status overview (toggle cleaning/available)
- My tasks (claim from unassigned pool, start, complete)
- Maintenance & damage reports (report new issues)
- Work history analytics (my history + all hotel toggle)

## Project Structure

```
.
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, Register
│   ├── (booking)/         # User bookings
│   ├── (public)/          # Public pages (home, rooms)
│   ├── reception/         # Reception dashboard
│   ├── actions/           # Server actions
│   ├── api/               # Route handlers
│   └── ...
├── components/            # React components
│   ├── layout/           # TopNavBar, Footer, Sidebar
│   ├── room/             # RoomCard, BookingWidget
│   ├── search/           # SearchBar, FilterSidebar
│   └── ...
├── lib/                   # Utilities
│   ├── data/             # Data access (mock + Supabase)
│   ├── supabase/         # Supabase clients
│   ├── pricing.ts        # Price calculations
│   └── dates.ts          # Date formatting
├── supabase/
│   ├── migrations/        # SQL migrations
│   └── seed*.sql          # Seed data
├── scripts/               # Utility scripts
│   ├── run-sql.mjs       # Direct DB migrations
│   ├── run-migrations.mjs
│   └── migrate-images.mjs
├── data/
│   ├── mock-rooms.json   # Mock room data
│   └── mock-amenities.json
├── proxy.ts               # Next.js 16 Proxy (replaces middleware)
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in values:
```bash
cp .env.example .env.local
```

### 3. Set up Supabase
1. Create a new Supabase project
2. Run migrations in order:
   - `supabase/migrations/20260818_init.sql` (profiles + auth)
   - `supabase/migrations/20260818_rls.sql`
   - `supabase/migrations/20260819_room_types.sql`
   - `supabase/migrations/20260819_room_types_rls.sql`
   - `supabase/migrations/20260819_bookings.sql`
   - `supabase/migrations/20260819_bookings_rls.sql`
   - `supabase/migrations/20260820_staff_role.sql`
   - `supabase/migrations/20260820_staff_rls.sql`
3. Update `.env.local` with Supabase URL/keys
4. Set `USE_MOCK_DATA=0`

You can also run via script:
```bash
node scripts/run-sql.mjs supabase/migrations/<file>.sql
```

### 4. Set up Cloudflare R2
1. Create R2 bucket
2. Add credentials to `.env.local`
3. Run image migration:
```bash
node scripts/migrate-images.mjs
```

### 5. Run dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Test Users

After running migrations, create test users via Supabase Dashboard or Admin API:

| Role | Email | Password |
|------|-------|----------|
| Reception | test@zenzero.com | TestPass123! |
| Customer | somchai@example.com | UserPass123! |
| Reception | malee@zenzero.com | Reception123! |
| Housekeeper | somjit@zenzero.com | Housekeep123! |
| Housekeeper | niran@zenzero.com | Housekeep123! |

To make a user `reception` role, run:
```sql
UPDATE public.profiles SET role = 'reception' WHERE id = '<user-id>';
```

## Scripts

```bash
npm run dev                # Start dev server
npm run build              # Production build
npm run start              # Run production build
npm run lint               # ESLint
npm run typecheck          # TypeScript check
npm run images:migrate     # Upload images to R2
node scripts/run-sql.mjs <file.sql>  # Run SQL migration
```

## Database Schema

### Core tables
- `profiles` — User data + role (auto-created on signup)
- `room_types` — Room catalog (10 rooms)
- `room_units` — Physical rooms (10 units across 4 floors)
- `amenities` — Amenity catalog

### Booking tables
- `bookings` — Reservations
- `reviews` — Post-stay reviews
- `cancellation_policies` — Policy catalog
- `promotions` — Promo codes

### Operations tables
- `booking_events` — Audit log
- `guest_notes` — Guest requests & notes

All tables have RLS policies. Staff can read/update all records; customers can only access their own.

## Environment Variables

See [`.env.example`](.env.example) for the full list.

## License

MIT
