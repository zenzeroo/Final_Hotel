-- =========================================================
-- Zenzero Hotel — Phase 5: Reviews & Ratings
-- Date: 2026-08-27
-- =========================================================
-- Adds a status column to reviews for moderation, replaces the
-- over-broad public-read policy, adds staff/admin policies, and
-- rewrites recalc_room_rating() to count only approved reviews.
-- =========================================================

-- Add status column + index for moderation queue
alter table public.reviews
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'hidden'));

create index if not exists idx_reviews_status
  on public.reviews(status, created_at desc) where status <> 'hidden';

-- Audit columns
alter table public.reviews
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

-- =========================================================
-- Drop old policies (idempotent) and recreate with status filters
-- =========================================================
drop policy if exists "review public read"  on public.reviews;
drop policy if exists "review owner insert" on public.reviews;
drop policy if exists "review owner update" on public.reviews;
drop policy if exists "review public read approved" on public.reviews;
drop policy if exists "review owner read own"        on public.reviews;
drop policy if exists "review owner write own"       on public.reviews;
drop policy if exists "review staff read"           on public.reviews;
drop policy if exists "review staff update"         on public.reviews;
drop policy if exists "review admin delete"         on public.reviews;

-- Anonymous + authenticated users can read APPROVED reviews on the public room page
create policy "review public read approved"
  on public.reviews for select
  to anon, authenticated
  using (status = 'approved');

-- Owner can read their own review regardless of status
create policy "review owner read own"
  on public.reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Staff can read all reviews (moderation queue)
create policy "review staff read"
  on public.reviews for select
  to authenticated
  using (public.is_staff());

-- Owner can create their own review (guest self-service)
create policy "review owner insert"
  on public.reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Staff can update status (approve / hide / unhide)
create policy "review staff update"
  on public.reviews for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Admin-only hard delete
create policy "review admin delete"
  on public.reviews for delete
  to authenticated
  using (public.has_role('admin'));

-- =========================================================
-- Recalculate room rating on review change
-- Counts only APPROVED reviews so pending / hidden don't drag rating down.
-- =========================================================
create or replace function public.recalc_room_rating() returns trigger
language plpgsql
as $$
declare target_id uuid;
begin
  target_id := coalesce(new.room_type_id, old.room_type_id);
  if target_id is not null then
    update public.room_types r set
      rating_avg   = coalesce((select avg(rating)::numeric(2,1)
                              from public.reviews
                              where room_type_id = r.id and status = 'approved'), 0),
      rating_count = coalesce((select count(*)
                              from public.reviews
                              where room_type_id = r.id and status = 'approved'), 0)
    where r.id = target_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_recalc_rating on public.reviews;
create trigger trg_recalc_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_room_rating();

-- =========================================================
-- Defense in depth: prevent staff UPDATE from rewriting
-- user-provided content (rating, title, body, ownership).
-- Staff may only change status + audit columns.
-- =========================================================
create or replace function public.reviews_guard_staff_update() returns trigger
language plpgsql
as $$
begin
  -- Bypass for owners updating their own review (status changes still allowed
  -- since owners can also delete via the application layer). The check is:
  -- if the row's user_id is being changed OR if a content field is being
  -- changed by anyone other than the owner, raise an exception.
  if new.user_id is distinct from old.user_id then
    raise exception 'reviews.user_id is immutable';
  end if;
  if new.room_type_id is distinct from old.room_type_id then
    raise exception 'reviews.room_type_id is immutable';
  end if;
  if new.booking_id is distinct from old.booking_id then
    raise exception 'reviews.booking_id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'reviews.created_at is immutable';
  end if;
  -- Content fields: if a staff member (anyone whose user_id does not match)
  -- tries to change rating/title/body, reject.
  if (select auth.uid()) is distinct from old.user_id then
    if new.rating is distinct from old.rating then
      raise exception 'staff cannot modify reviews.rating';
    end if;
    if (new.title is distinct from old.title)
       or (new.body is distinct from old.body) then
      raise exception 'staff cannot modify reviews content (title/body)';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_reviews_guard_staff_update on public.reviews;
create trigger trg_reviews_guard_staff_update
  before update on public.reviews
  for each row execute function public.reviews_guard_staff_update();
