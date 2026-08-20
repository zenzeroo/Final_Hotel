-- Housekeeping tasks table
create type housekeeping_task_type as enum ('cleaning', 'turn_down', 'deep_clean', 'inspection', 'restock');
create type housekeeping_task_status as enum ('unassigned', 'assigned', 'in_progress', 'completed', 'cancelled');
create type housekeeping_task_priority as enum ('low', 'normal', 'high', 'urgent');

create table if not exists public.housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  room_unit_id uuid not null references public.room_units(id) on delete cascade,
  task_type housekeeping_task_type not null default 'cleaning',
  priority housekeeping_task_priority not null default 'normal',
  status housekeeping_task_status not null default 'unassigned',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id) on delete set null,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on public.housekeeping_tasks(status);
create index if not exists idx_tasks_assigned on public.housekeeping_tasks(assigned_to, status);
create index if not exists idx_tasks_unit on public.housekeeping_tasks(room_unit_id);
create index if not exists idx_tasks_created on public.housekeeping_tasks(created_at desc);

-- Trigger: keep room_units.status in sync with task lifecycle
create or replace function on_task_status_change() returns trigger as $$
begin
  if new.status = 'in_progress' and (old.status is null or old.status = 'assigned') then
    update public.room_units set status = 'cleaning', updated_at = now() where id = new.room_unit_id;
  elsif new.status = 'completed' and old.status != 'completed' then
    update public.room_units set status = 'available', updated_at = now() where id = new.room_unit_id;
  elsif new.status = 'cancelled' and old.status in ('assigned', 'in_progress') then
    update public.room_units set status = 'available', updated_at = now() where id = new.room_unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_task_status on public.housekeeping_tasks;
create trigger trg_task_status
  after update of status on public.housekeeping_tasks
  for each row execute function on_task_status_change();

-- Auto-update updated_at
create or replace function touch_housekeeping_task() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_task_touch on public.housekeeping_tasks;
create trigger trg_task_touch
  before update on public.housekeeping_tasks
  for each row execute function touch_housekeeping_task();