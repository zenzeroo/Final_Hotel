-- Add updated_at column to room_units (needed by housekeeping triggers
-- that do `update room_units set status=..., updated_at=now()`)
alter table public.room_units add column if not exists updated_at timestamptz;

-- Auto-touch on update
create or replace function touch_room_unit() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_room_unit_touch on public.room_units;
create trigger trg_room_unit_touch
  before update on public.room_units
  for each row execute function touch_room_unit();