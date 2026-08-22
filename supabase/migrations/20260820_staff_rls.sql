-- =========================================================
-- Zenzero Hotel — Phase 4: Staff RLS
-- Date: 2026-08-20
-- =========================================================

-- Enable RLS
alter table public.room_units enable row level security;
alter table public.booking_events enable row level security;
alter table public.guest_notes enable row level security;

-- Drop existing policies (idempotent)
drop policy if exists "room_units public read" on public.room_units;
drop policy if exists "room_units staff write" on public.room_units;
drop policy if exists "booking_events self read" on public.booking_events;
drop policy if exists "booking_events staff read" on public.booking_events;
drop policy if exists "booking_events staff insert" on public.booking_events;
drop policy if exists "guest_notes guest read" on public.guest_notes;
drop policy if exists "guest_notes staff read" on public.guest_notes;
drop policy if exists "guest_notes staff write" on public.guest_notes;

-- room_units: public read, staff write
create policy "room_units public read"
  on public.room_units for select
  to anon, authenticated
  using (is_active = true);

create policy "room_units staff write"
  on public.room_units for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

-- booking_events: booking owner can read own, staff can read all
create policy "booking_events self read"
  on public.booking_events for select
  to authenticated
  using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid()))
  );

create policy "booking_events staff read"
  on public.booking_events for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

create policy "booking_events staff insert"
  on public.booking_events for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

-- guest_notes: guest reads own, staff reads/writes all
create policy "guest_notes guest read"
  on public.guest_notes for select
  to authenticated
  using (guest_id = (select auth.uid()));

create policy "guest_notes staff read"
  on public.guest_notes for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

create policy "guest_notes staff write"
  on public.guest_notes for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

-- Staff can read all profiles (for customer search)
drop policy if exists "profiles staff read all" on public.profiles;
create policy "profiles staff read all"
  on public.profiles for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

-- Staff can read all bookings (for management)
drop policy if exists "bookings staff read" on public.bookings;
create policy "bookings staff read"
  on public.bookings for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );

drop policy if exists "bookings staff update" on public.bookings;
create policy "bookings staff update"
  on public.bookings for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reception','housekeeper','manager','admin'))
  );
