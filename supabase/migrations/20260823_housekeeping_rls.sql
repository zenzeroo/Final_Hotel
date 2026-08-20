-- housekeeping_tasks RLS
alter table public.housekeeping_tasks enable row level security;

drop policy if exists "tasks staff or self select" on public.housekeeping_tasks;
create policy "tasks staff or self select"
  on public.housekeeping_tasks for select
  to authenticated
  using (
    public.is_staff()
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  );

drop policy if exists "tasks reception insert" on public.housekeeping_tasks;
create policy "tasks reception insert"
  on public.housekeeping_tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'admin')
    )
  );

drop policy if exists "tasks self or staff update" on public.housekeeping_tasks;
create policy "tasks self or staff update"
  on public.housekeeping_tasks for update
  to authenticated
  using (
    public.is_staff()
    or (assigned_to = (select auth.uid()) and status in ('assigned', 'in_progress'))
  )
  with check (
    public.is_staff()
    or (assigned_to = (select auth.uid()) and status in ('assigned', 'in_progress'))
  );

drop policy if exists "tasks admin delete" on public.housekeeping_tasks;
create policy "tasks admin delete"
  on public.housekeeping_tasks for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- maintenance_reports RLS
alter table public.maintenance_reports enable row level security;

drop policy if exists "maint staff select" on public.maintenance_reports;
create policy "maint staff select"
  on public.maintenance_reports for select
  to authenticated
  using (public.is_staff());

drop policy if exists "maint staff insert" on public.maintenance_reports;
create policy "maint staff insert"
  on public.maintenance_reports for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "maint reception update" on public.maintenance_reports;
create policy "maint reception update"
  on public.maintenance_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('reception', 'admin')
    )
  );