-- =========================================================
-- Zenzero Hotel — Phase 3: Bookings + Reviews + Policies
-- Date: 2026-08-19
-- =========================================================

-- Enums
do $$ begin
  create type booking_status as enum ('pending','confirmed','checked_in','checked_out','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('unpaid','paid','refunded','partial_refund');
exception when duplicate_object then null; end $$;

-- =========================================================
-- cancellation_policies
-- =========================================================
create table if not exists public.cancellation_policies (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,           -- 'Flexible','Strict'
  free_cancel_hours smallint default 24,
  description       text not null,
  is_default        boolean default false,
  created_at        timestamptz default now()
);

-- =========================================================
-- promotions
-- =========================================================
create table if not exists public.promotions (
  id              uuid primary key default uuid_generate_v4(),
  code            text unique,                -- 'EARLY15'
  name            text not null,
  description     text,
  discount_type   text check (discount_type in ('percent','flat')),
  discount_value  numeric(10,2) not null,
  min_nights      smallint default 1,
  valid_from      date,
  valid_until     date,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- =========================================================
-- bookings
-- =========================================================
create table if not exists public.bookings (
  id                      uuid primary key default uuid_generate_v4(),
  booking_code            text unique not null,             -- 'ZZR-12345' (display)
  user_id                 uuid references public.profiles(id) on delete restrict not null,
  room_type_id            uuid references public.room_types(id) on delete restrict not null,
  check_in                date not null,
  check_out               date not null,
  guests                  smallint not null default 1,
  nights                  smallint not null,
  base_subtotal           numeric(10,2) not null,
  discount_total          numeric(10,2) default 0,
  tax_total               numeric(10,2) default 0,
  fee_total               numeric(10,2) default 0,
  total                   numeric(10,2) not null,
  currency                text default 'THB',
  promotion_id            uuid references public.promotions(id),
  cancellation_policy_id  uuid references public.cancellation_policies(id),
  status                  booking_status default 'pending',
  payment_status          payment_status default 'unpaid',
  booker_full_name        text not null,
  booker_email            text not null,
  booker_phone            text,
  special_request         text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  constraint chk_dates check (check_out > check_in)
);

create index if not exists idx_bookings_user on public.bookings(user_id, status, check_in desc);
create index if not exists idx_bookings_code on public.bookings(booking_code);
create index if not exists idx_bookings_room on public.bookings(room_type_id);

-- updated_at trigger
drop trigger if exists trg_bookings_touch_updated_at on public.bookings;
create trigger trg_bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- =========================================================
-- reviews
-- =========================================================
create table if not exists public.reviews (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles(id) on delete cascade not null,
  room_type_id uuid references public.room_types(id) on delete cascade not null,
  booking_id   uuid references public.bookings(id) on delete set null,
  rating       smallint check (rating between 1 and 5) not null,
  title        text,
  body         text,
  created_at   timestamptz default now(),
  unique (user_id, booking_id)
);

create index if not exists idx_reviews_room on public.reviews(room_type_id, created_at desc);

-- Recalculate room rating on review change
create or replace function public.recalc_room_rating() returns trigger
language plpgsql as $$
begin
  update public.room_types r set
    rating_avg   = coalesce((select avg(rating)::numeric(2,1) from public.reviews where room_type_id = r.id), 0),
    rating_count = coalesce((select count(*) from public.reviews where room_type_id = r.id), 0)
  where r.id = coalesce(new.room_type_id, old.room_type_id);
  return null;
end; $$;

drop trigger if exists trg_recalc_rating on public.reviews;
create trigger trg_recalc_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_room_rating();

-- =========================================================
-- Seed: cancellation policies
-- =========================================================
insert into public.cancellation_policies (id, name, free_cancel_hours, description, is_default) values
  ('11111111-1111-1111-1111-111111111111', 'Flexible', 24, 'ยกเลิกฟรีภายใน 24 ชั่วโมงก่อนเช็คอิน หลังจากนั้นจะถูกเรียกเก็บค่าห้องพัก 1 คืน', true),
  ('22222222-2222-2222-2222-222222222222', 'Moderate', 72, 'ยกเลิกฟรีภายใน 72 ชั่วโมงก่อนเช็คอิน หลังจากนั้นจะถูกเรียกเก็บ 50% ของค่าห้องพักทั้งหมด', false),
  ('33333333-3333-3333-3333-333333333333', 'Strict', 168, 'ยกเลิกฟรีภายใน 7 วันก่อนเช็คอิน หลังจากนั้นจะถูกเรียกเก็บค่าห้องพักเต็มจำนวน', false)
on conflict (id) do nothing;

-- =========================================================
-- Seed: promotions
-- =========================================================
insert into public.promotions (id, code, name, description, discount_type, discount_value, min_nights, is_active) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EARLY15', 'Early Bird 15%', 'จองล่วงหน้า 14 วัน ลด 15%', 'percent', 15.00, 1, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WELCOME10', 'Welcome 10%', 'ส่วนลดต้อนรับสมาชิกใหม่ 10%', 'percent', 10.00, 1, true)
on conflict (id) do nothing;
