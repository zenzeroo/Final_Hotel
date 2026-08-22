-- =========================================================
-- Zenzero Hotel — Add Manager Role
-- Date: 2026-08-25
-- =========================================================

-- Add 'manager' to user_role enum
do $$ begin
  alter type public.user_role add value 'manager';
exception when duplicate_object then null; end $$;

-- Update is_staff() helper to include manager
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
    and role in ('reception', 'housekeeper', 'manager', 'admin')
  );
$$;

-- =========================================================
-- Manager-specific policies (subset of staff + override where needed)
-- is_staff() now includes manager, so existing policies auto-apply.
-- Additional manager-only policies:
-- =========================================================

-- Manager can resolve maintenance reports (status='resolved' + set resolved_at)
drop policy if exists "maint manager resolve" on public.maintenance_reports;
create policy "maint manager resolve"
  on public.maintenance_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
    )
  );

-- Manager can update room_units.status (e.g. close a room after damage)
drop policy if exists "room_units manager update" on public.room_units;
create policy "room_units manager update"
  on public.room_units for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
    )
  );

-- =========================================================
-- Promote a user to manager (run manually after migration):
--   update public.profiles set role = 'manager' where id = '<uuid>';
-- =========================================================
