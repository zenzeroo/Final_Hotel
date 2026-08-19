-- =========================================================
-- Zenzero Hotel — Phase 4: Staff Role + Room Units
-- Date: 2026-08-20
-- =========================================================

-- Add role to profiles
do $$ begin
  create type user_role as enum ('user', 'reception', 'housekeeper', 'admin');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists role user_role default 'user' not null;

create index if not exists idx_profiles_role on public.profiles(role);

-- =========================================================
-- room_units (physical rooms on each floor)
-- =========================================================
create table if not exists public.room_units (
  id            uuid primary key default uuid_generate_v4(),
  room_type_id  uuid references public.room_types(id) on delete restrict not null,
  floor         smallint not null,
  unit_label    text not null,            -- '301','Villa-A'
  view_label    text,                    -- 'Ocean View'
  status        text default 'available' check (status in ('available','occupied','cleaning','maintenance','out_of_order')),
  is_active     boolean default true,
  created_at    timestamptz default now(),
  unique (floor, unit_label)
);

create index if not exists idx_room_units_status on public.room_units(status, floor);
create index if not exists idx_room_units_type on public.room_units(room_type_id);

-- =========================================================
-- booking_events (audit log)
-- =========================================================
create table if not exists public.booking_events (
  id            uuid primary key default uuid_generate_v4(),
  booking_id    uuid references public.bookings(id) on delete cascade not null,
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_role    user_role not null,
  event_type    text not null,            -- 'created','confirmed','checked_in','checked_out','cancelled','note_added'
  description   text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

create index if not exists idx_booking_events_booking on public.booking_events(booking_id, created_at desc);
create index if not exists idx_booking_events_actor on public.booking_events(actor_id, created_at desc);

-- =========================================================
-- guest_notes (for guest requests & notes)
-- =========================================================
create table if not exists public.guest_notes (
  id            uuid primary key default uuid_generate_v4(),
  booking_id    uuid references public.bookings(id) on delete cascade,
  guest_id      uuid references public.profiles(id) on delete cascade,
  staff_id      uuid references public.profiles(id) on delete set null,
  note_type     text default 'request' check (note_type in ('request','complaint','compliment','general')),
  title         text not null,
  body          text not null,
  is_resolved   boolean default false,
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz default now()
);

create index if not exists idx_guest_notes_booking on public.guest_notes(booking_id, created_at desc);
create index if not exists idx_guest_notes_resolved on public.guest_notes(is_resolved);

-- =========================================================
-- Seed: room_units (12 rooms across floors 1-4)
-- =========================================================
insert into public.room_units (room_type_id, floor, unit_label, view_label, status, is_active) values
  -- Floor 1: 1 Oasis Villa, 1 Garden View Pavilion
  ('00000000-0000-0000-0000-000000000003', 1, 'V-01', 'Pool View', 'available', true),
  ('00000000-0000-0000-0000-000000000010', 1, 'P-01', 'Pool View', 'available', true),
  -- Floor 2: 1 Botanic King, 1 Deluxe Forest Suite
  ('00000000-0000-0000-0000-000000000002', 2, '201', 'Garden View', 'available', true),
  ('00000000-0000-0000-0000-000000000009', 2, '202', 'Forest View', 'available', true),
  -- Floor 3: 1 Serenity Suite, 1 Ocean Grand Deluxe, 1 Ocean Twin Premium, 1 Heritage Twin
  ('00000000-0000-0000-0000-000000000001', 3, '301', 'Forest View', 'available', true),
  ('00000000-0000-0000-0000-000000000005', 3, '302', 'Ocean View', 'available', true),
  ('00000000-0000-0000-0000-000000000006', 3, '303', 'Ocean View', 'available', true),
  ('00000000-0000-0000-0000-000000000004', 3, '304', 'Courtyard View', 'available', true),
  -- Floor 4: 1 Executive Corner Suite, 1 The Heritage Suite
  ('00000000-0000-0000-0000-000000000007', 4, '401', 'Ocean View', 'available', true),
  ('00000000-0000-0000-0000-000000000008', 4, '402', 'Garden View', 'available', true)
on conflict (floor, unit_label) do nothing;
