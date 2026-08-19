-- =========================================================
-- Zenzero Hotel — Phase 3: RLS for Bookings + Reviews
-- Date: 2026-08-19
-- =========================================================

-- Enable RLS
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.cancellation_policies enable row level security;
alter table public.promotions enable row level security;

-- Drop existing policies (idempotent)
drop policy if exists "booking self select" on public.bookings;
drop policy if exists "booking self insert" on public.bookings;
drop policy if exists "booking self update" on public.bookings;
drop policy if exists "review public read" on public.reviews;
drop policy if exists "review owner insert" on public.reviews;
drop policy if exists "review owner update" on public.reviews;
drop policy if exists "cancellation_policies public read" on public.cancellation_policies;
drop policy if exists "promotions public read" on public.promotions;

-- Bookings: user can see, insert, and update their own (with restrictions)
create policy "booking self select"
  on public.bookings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "booking self insert"
  on public.bookings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Users can update own bookings but can only change to certain statuses
create policy "booking self update"
  on public.bookings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and status in ('pending','confirmed','cancelled')
  );

-- Reviews: anyone can read, only booking owner can write
create policy "review public read"
  on public.reviews for select
  to anon, authenticated
  using (true);

create policy "review owner insert"
  on public.reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "review owner update"
  on public.reviews for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Cancellation policies: public read
create policy "cancellation_policies public read"
  on public.cancellation_policies for select
  to anon, authenticated
  using (true);

-- Promotions: public read (only active ones)
create policy "promotions public read"
  on public.promotions for select
  to anon, authenticated
  using (is_active = true);
