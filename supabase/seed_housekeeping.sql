-- ============================================================
-- Phase 5 Housekeeping Seed Data
-- ============================================================
-- Reference housekeeper users:
--   somjit@zenzero.com = 914c059a-1973-4a7a-b4be-2a8e18717ad4 (u-house-1)
--   niran@zenzero.com   = 34a8f6e5-aa73-4f78-a43e-dd045535ec4e (u-house-2)
--
-- Reference reception user:
--   malee@zenzero.com   (see profiles table for ID)
--
-- Reference room units:
--   P-01  = 1d5a8786-e753-470b-a7c7-260111271a8a
--   V-01  = 8d5c665c-45ce-4d6d-8e56-bdb5d2fb89f0
--   201   = 7f25b853-577f-4fe0-b1b0-9a6285234cf8
--   202   = f31c977c-221e-4189-bad4-d14120a210d5
--   301   = ff1fdcc0-b882-443e-9f48-184c0f8121b0
--   302   = ddca8928-dd32-476d-9ea2-d9c4a3ae1b5b
--   303   = 43fea709-f2ab-46b4-9cb9-48a0230fb396
--   304   = 1a9c4e39-f8fd-483d-a34d-070da4a56625
--   401   = 8a11768e-64cc-4c53-8120-46eecca12655
--   402   = 7520c866-a435-418b-a9c4-0e5684bf42ff

-- Use the actual reception user ID from profiles
do $$
declare
  recep_id uuid;
begin
  select id into recep_id from public.profiles where role = 'reception' limit 1;

  -- ============================================================
  -- Housekeeping Tasks (10 tasks across statuses)
  -- ============================================================

  -- Unassigned tasks (in pool)
  insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, created_by, notes)
  values
    ('7f25b853-577f-4fe0-b1b0-9a6285234cf8', 'cleaning', 'high', 'unassigned', recep_id, 'Guest checked out at 11:30'),
    ('f31c977c-221e-4189-bad4-d14120a210d5', 'cleaning', 'normal', 'unassigned', recep_id, null),
    ('1a9c4e39-f8fd-483d-a34d-070da4a56625', 'deep_clean', 'normal', 'unassigned', recep_id, 'Monthly deep clean');

  -- Tasks assigned to somjit (u-house-1)
  insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, assigned_to, created_by, notes)
  values
    ('ddca8928-dd32-476d-9ea2-d9c4a3ae1b5b', 'inspection', 'high', 'assigned', '914c059a-1973-4a7a-b4be-2a8e18717ad4', recep_id, 'VIP suite — verify minibar stocked'),
    ('8a11768e-64cc-4c53-8120-46eecca12655', 'cleaning', 'normal', 'in_progress', '914c059a-1973-4a7a-b4be-2a8e18717ad4', recep_id, null);

  -- Tasks assigned to niran (u-house-2)
  insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, assigned_to, created_by, notes)
  values
    ('1d5a8786-e753-470b-a7c7-260111271a8a', 'turn_down', 'low', 'assigned', '34a8f6e5-aa73-4f78-a43e-dd045535ec4e', recep_id, 'Evening turn-down'),
    ('8d5c665c-45ce-4d6d-8e56-bdb5d2fb89f0', 'restock', 'normal', 'in_progress', '34a8f6e5-aa73-4f78-a43e-dd045535ec4e', recep_id, 'Restock towels + toiletries');

  -- Completed tasks (for history + shift progress)
  insert into public.housekeeping_tasks (room_unit_id, task_type, priority, status, assigned_to, created_by, notes, started_at, completed_at)
  values
    ('ff1fdcc0-b882-443e-9f48-184c0f8121b0', 'cleaning', 'urgent', 'completed', '914c059a-1973-4a7a-b4be-2a8e18717ad4', recep_id, 'Rushed for incoming guest', now() - interval '2 hours', now() - interval '1 hour 30 minutes'),
    ('43fea709-f2ab-46b4-9cb9-48a0230fb396', 'cleaning', 'normal', 'completed', '914c059a-1973-4a7a-b4be-2a8e18717ad4', recep_id, null, now() - interval '3 hours', now() - interval '2 hours 30 minutes'),
    ('7520c866-a435-418b-a9c4-0e5684bf42ff', 'cleaning', 'normal', 'completed', '34a8f6e5-aa73-4f78-a43e-dd045535ec4e', recep_id, null, now() - interval '4 hours', now() - interval '3 hours 30 minutes');

  -- ============================================================
  -- Maintenance Reports (5 reports across statuses)
  -- ============================================================
  insert into public.maintenance_reports (room_unit_id, issue_type, severity, status, title, description, reported_by)
  values
    ('7f25b853-577f-4fe0-b1b0-9a6285234cf8', 'plumbing', 'high', 'open', 'Sink draining slowly', 'Bathroom sink takes 3+ minutes to drain. Guest complained.', '914c059a-1973-4a7a-b4be-2a8e18717ad4'),
    ('1a9c4e39-f8fd-483d-a34d-070da4a56625', 'hvac', 'critical', 'open', 'AC unit not cooling', 'AC running but blowing warm air. Room unusable.', '914c059a-1973-4a7a-b4be-2a8e18717ad4'),
    ('ddca8928-dd32-476d-9ea2-d9c4a3ae1b5b', 'furniture', 'low', 'open', 'Drawer handle loose', 'Top drawer of bedside table — handle loose but functional.', '34a8f6e5-aa73-4f78-a43e-dd045535ec4e'),
    ('ff1fdcc0-b882-443e-9f48-184c0f8121b0', 'electrical', 'medium', 'in_progress', 'Bedside lamp flickering', 'Left bedside lamp flickers intermittently. Bulb replaced but issue persists.', recep_id),
    ('43fea709-f2ab-46b4-9cb9-48a0230fb396', 'appliance', 'low', 'resolved', 'Coffee maker leaking', 'Drip tray overflow during brewing. Replaced unit.', '914c059a-1973-4a7a-b4be-2a8e18717ad4');

  -- ============================================================
  -- Update room statuses to reflect task state (triggers handle
  -- in_progress + completed tasks automatically; this covers
  -- unassigned + cleaning rooms that should be dirty)
  -- ============================================================
  update public.room_units set status = 'cleaning' where id in (
    '7f25b853-577f-4fe0-b1b0-9a6285234cf8',  -- 201
    'f31c977c-221e-4189-bad4-d14120a210d5'   -- 202
  );
  update public.room_units set status = 'maintenance' where id = '1a9c4e39-f8fd-483d-a34d-070da4a56625';  -- 304 (critical)
end $$;