create type maintenance_issue_type as enum ('plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other');
create type maintenance_severity as enum ('low', 'medium', 'high', 'critical');
create type maintenance_status as enum ('open', 'in_progress', 'resolved');

create table if not exists public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  room_unit_id uuid not null references public.room_units(id) on delete cascade,
  issue_type maintenance_issue_type not null,
  severity maintenance_severity not null default 'medium',
  status maintenance_status not null default 'open',
  title text not null,
  description text,
  reported_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_maint_status on public.maintenance_reports(status, severity);
create index if not exists idx_maint_unit on public.maintenance_reports(room_unit_id);
create index if not exists idx_maint_reporter on public.maintenance_reports(reported_by);
create index if not exists idx_maint_created on public.maintenance_reports(created_at desc);

-- Trigger: critical severity auto-flags room as 'maintenance'
create or replace function on_maintenance_insert() returns trigger as $$
begin
  if new.severity = 'critical' then
    update public.room_units set status = 'maintenance', updated_at = now() where id = new.room_unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_maint_insert on public.maintenance_reports;
create trigger trg_maint_insert
  after insert on public.maintenance_reports
  for each row execute function on_maintenance_insert();

-- Touch updated_at
create or replace function touch_maintenance_report() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_maint_touch on public.maintenance_reports;
create trigger trg_maint_touch
  before update on public.maintenance_reports
  for each row execute function touch_maintenance_report();