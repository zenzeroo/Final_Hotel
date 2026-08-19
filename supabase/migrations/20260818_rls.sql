-- =========================================================
-- Zenzero Hotel — Phase 2: RLS Policies
-- Date: 2026-08-18
-- =========================================================

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Drop existing policies if any (idempotent)
drop policy if exists "profile self read" on public.profiles;
drop policy if exists "profile self update" on public.profiles;
drop policy if exists "profile self insert" on public.profiles;

-- Users can read their own profile
create policy "profile self read"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Users can update their own profile (but NOT id)
create policy "profile self update"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Insert is handled by the trigger on auth.users
-- (no policy needed — SECURITY DEFINER skips RLS)
