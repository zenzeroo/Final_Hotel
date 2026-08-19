-- =========================================================
-- Zenzero Hotel — Phase 2: Auth + Profiles
-- Date: 2026-08-18
-- =========================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =========================================================
-- profiles table (mirrors auth.users)
-- =========================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  phone        text,
  avatar_key   text,                    -- R2 object key
  locale       text default 'th',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

comment on table public.profiles is 'User profile data, mirrored from auth.users';

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- updated_at trigger for profiles
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
