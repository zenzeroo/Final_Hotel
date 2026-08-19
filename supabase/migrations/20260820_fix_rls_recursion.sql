-- =========================================================
-- Fix: RLS Infinite Recursion in profiles
-- Date: 2026-08-20
-- =========================================================

-- Helper function: check if current user is staff (bypasses RLS)
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
    and role in ('reception', 'housekeeper', 'admin')
  );
$$;

-- Helper function: check if current user has specific role
create or replace function public.has_role(check_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
    and role = check_role::public.user_role
  );
$$;

-- Drop and recreate staff policies (replace exists subquery with function call)
drop policy if exists "bookings staff read" on public.bookings;
drop policy if exists "bookings staff update" on public.bookings;
drop policy if exists "room_units staff write" on public.room_units;
drop policy if exists "booking_events staff read" on public.booking_events;
drop policy if exists "booking_events staff insert" on public.booking_events;
drop policy if exists "guest_notes staff read" on public.guest_notes;
drop policy if exists "guest_notes staff write" on public.guest_notes;
drop policy if exists "profiles staff read all" on public.profiles;

-- bookings
create policy "bookings staff read"
  on public.bookings for select
  to authenticated
  using (public.is_staff());

create policy "bookings staff update"
  on public.bookings for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- room_units
create policy "room_units staff write"
  on public.room_units for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- booking_events
create policy "booking_events staff read"
  on public.booking_events for select
  to authenticated
  using (public.is_staff());

create policy "booking_events staff insert"
  on public.booking_events for insert
  to authenticated
  with check (public.is_staff());

-- guest_notes
create policy "guest_notes staff read"
  on public.guest_notes for select
  to authenticated
  using (public.is_staff());

create policy "guest_notes staff write"
  on public.guest_notes for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- profiles
create policy "profiles staff read all"
  on public.profiles for select
  to authenticated
  using (public.is_staff());
