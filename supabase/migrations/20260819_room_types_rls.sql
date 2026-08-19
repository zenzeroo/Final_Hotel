-- =========================================================
-- Zenzero Hotel — Phase 1 RLS: Room Types + Amenities
-- Date: 2026-08-19
-- =========================================================

-- Enable RLS
alter table public.room_types enable row level security;
alter table public.amenities enable row level security;

-- Drop existing policies if any (idempotent)
drop policy if exists "public read room_types" on public.room_types;
drop policy if exists "public read amenities" on public.amenities;

-- Public read access (anon + authenticated)
create policy "public read room_types"
  on public.room_types
  for select
  to anon, authenticated
  using (is_active = true);

create policy "public read amenities"
  on public.amenities
  for select
  to anon, authenticated
  using (true);

-- Note: Writes are done via service role only (admin/scripts).
-- No policy = no public write access.
