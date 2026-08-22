-- =========================================================
-- Zenzero Hotel — Fix Manager RLS Policies
-- Date: 2026-08-26
-- =========================================================
--
-- Security review of 20260825_add_manager_role.sql found 2 issues:
--   1. over-broad-grant — the two new policies (maint manager resolve,
--      room_units manager update) allow manager/admin to UPDATE every
--      column without restriction.
--   2. redundant-policy — both are duplicate grants once 'manager' is
--      added to the existing inline role lists (and is_staff() already
--      widened to include 'manager').
--
-- This migration:
--   A. Drops the 2 over-broad policies from 20260825.
--   B. Recreates the 20260823 inline policies (housekeeping_tasks INSERT,
--      maintenance_reports UPDATE) with 'manager' added to the inline
--      role list so manager is treated like other staff via the same
--      code path. Tasks admin delete stays admin-only.
--
-- After this migration:
--   - room_units UPDATE        → unchanged (already via is_staff() since 20260825)
--   - maintenance_reports UPDATE → reception/manager/admin (was reception/admin)
--   - housekeeping_tasks INSERT  → reception/manager/admin (was reception/admin)

-- =========================================================
-- A. Drop the over-broad policies from 20260825
-- =========================================================

drop policy if exists "maint manager resolve" on public.maintenance_reports;
drop policy if exists "room_units manager update" on public.room_units;

-- =========================================================
-- B. Recreate 20260823 inline policies with 'manager' widened
-- =========================================================

-- housekeeping_tasks: reception can create tasks → now also manager
drop policy if exists "tasks reception insert" on public.housekeeping_tasks;
create policy "tasks reception insert"
  on public.housekeeping_tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'manager', 'admin')
    )
  );

-- maintenance_reports: reception can update reports → now also manager
drop policy if exists "maint reception update" on public.maintenance_reports;
create policy "maint reception update"
  on public.maintenance_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'manager', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'manager', 'admin')
    )
  );