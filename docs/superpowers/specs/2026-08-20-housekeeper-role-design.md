# Phase 5: Housekeeper Role — Design Spec

**Status**: Approved (brainstorming complete)
**Date**: 2026-08-20
**Scope**: Add Housekeeper role to Zenzero Hotel — 5 pages, 2 new tables, server actions, mock + real data layers

---

## 1. Architecture & Data Flow

Pattern mirrors Reception role for consistency:

```
proxy.ts → /housekeeper → app/housekeeper/layout.tsx (role check)
                                ↓
                              StaffSidebar (HOUSEKEEPER_NAV — already exists)
                                ↓
                         pages (5 หน้า)
                                ↓
                         lib/data/housekeeper.ts (toggle USE_MOCK_DATA)
                                ↓
                    housekeeping_tasks + maintenance_reports tables
```

**Data layer pattern** — identical to `lib/data/staff.ts`:
- `lib/data/housekeeper.ts` — public interface
- `lib/data/mock-housekeeper.ts` — reads `data/mock-housekeeper.json`
- `lib/data/supabase-housekeeper.ts` — real queries

**Server actions** — new file `app/actions/housekeeping.ts`:
- `claimTask`, `startTask`, `completeTask`, `reportMaintenance`, `updateRoomStatus`

---

## 2. Database Schema

### Migration 1: `20260821_housekeeping_tasks.sql`

```sql
create type housekeeping_task_type as enum ('cleaning', 'turn_down', 'deep_clean', 'inspection', 'restock');
create type housekeeping_task_status as enum ('unassigned', 'assigned', 'in_progress', 'completed', 'cancelled');
create type housekeeping_task_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.housekeeping_tasks (
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

create index idx_tasks_status on public.housekeeping_tasks(status);
create index idx_tasks_assigned on public.housekeeping_tasks(assigned_to, status);
create index idx_tasks_unit on public.housekeeping_tasks(room_unit_id);
create index idx_tasks_created on public.housekeeping_tasks(created_at desc);
```

### Migration 2: `20260822_maintenance_reports.sql`

```sql
create type maintenance_issue_type as enum ('plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other');
create type maintenance_severity as enum ('low', 'medium', 'high', 'critical');
create type maintenance_status as enum ('open', 'in_progress', 'resolved');

create table public.maintenance_reports (
  id uuid primary key default gen_random_uuid(),
  room_unit_id uuid not null references public.room_units(id) on delete cascade,
  issue_type maintenance_issue_type not null,
  severity maintenance_severity not null default 'medium',
  status maintenance_status not null default 'open',
  title text not null,
  description text,
  reported_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),  -- for future manager role
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_maint_status on public.maintenance_reports(status, severity);
create index idx_maint_unit on public.maintenance_reports(room_unit_id);
create index idx_maint_reporter on public.maintenance_reports(reported_by);
```

### Trigger (in migration 1)

```sql
create function on_task_complete() returns trigger as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    update room_units set status = 'available', updated_at = now()
    where id = new.room_unit_id;
  end if;
  if new.status = 'in_progress' and old.status = 'assigned' then
    update room_units set status = 'cleaning', updated_at = now()
    where id = new.room_unit_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_task_status after update of status on public.housekeeping_tasks
  for each row execute function on_task_complete();
```

### RLS (Migration 3: `20260823_housekeeping_rls.sql`)

- `housekeeping_tasks`:
  - SELECT: `(is_staff() OR assigned_to = (select auth.uid()))`
  - INSERT: `(SELECT role FROM profiles WHERE id = (select auth.uid())) IN ('reception', 'admin')`
  - UPDATE: `(assigned_to = (select auth.uid()) AND status IN ('assigned', 'in_progress')) OR is_staff()`
  - DELETE: admin only
- `maintenance_reports`:
  - SELECT: `is_staff()`
  - INSERT: `is_staff()` (housekeeper + reception)
  - UPDATE: `(SELECT role FROM profiles WHERE id = (select auth.uid())) IN ('reception', 'admin')` — resolve disabled in Phase 5

---

## 3. Pages & Components

### `/housekeeper` — Dashboard

Server Component + Client stat cards. 4 stat cards: Rooms to Clean, Shift Progress, My Tasks, Maintenance Issues. Priority Tasks list (top 5). My Active Tasks list. "Report Maintenance" quick action.

### `/housekeeper/rooms` — Room Status Overview

Server Component. List all 12 `room_units`. Filter chips by status. Each card shows floor + unit_label, room_type.name, view_label, status badge. **Edit dropdown enabled only when status is cleaning or available** — calls `updateRoomStatus`.

### `/housekeeper/tasks` — My Tasks

Server Component. Two sections: "My Tasks" (assigned to me), "Unassigned Pool" (with Claim button). Table columns: room, task_type, priority badge, status, created_at, actions. Filters: status, task_type.

### `/housekeeper/history` — Work History Analytics

Server Component. Toggle: My History | All Hotel. Stats: Rooms Cleaned, Avg Time, Tasks Today/Week. Daily Cleaning Performance chart (last 7 days, simple SVG bar chart). Recent Task Log table (last 20).

### `/housekeeper/maintenance` — Maintenance Reports

Server Component. "New Report" button opens modal form (issue_type, severity, title, description, room_unit). Filter: status, severity. Table: room, issue_type, severity badge, title, status, reported_by, created_at. **No Resolve button in Phase 5.**

### New components — `components/housekeeping/` (10 files)

- `TaskCard.tsx`
- `TaskClaimButton.tsx` (Client)
- `RoomStatusCard.tsx`
- `RoomStatusDropdown.tsx` (Client)
- `MaintenanceReportModal.tsx` (Client)
- `PriorityBadge.tsx`, `StatusBadge.tsx`, `SeverityBadge.tsx` (3 badges)
- `ShiftProgress.tsx`
- `DailyPerformanceChart.tsx` (SVG, no chart lib)

### Mock data — `data/mock-housekeeper.json`

12 rooms, 8-10 tasks mixed across users, 5-6 maintenance reports, 30+ history records.

---

## 4. Server Actions, Integration & Triggers

**File**: `app/actions/housekeeping.ts` — all use anon key + RLS (no service role)

```typescript
'use server'

export async function claimTask(taskId: string): Promise<ActionResult>
// Auth: housekeeper/admin
// Update: SET status='assigned', assigned_to=current_user_id WHERE id=? AND status='unassigned'

export async function startTask(taskId: string): Promise<ActionResult>
// Auth: assigned housekeeper/admin
// Update: status='in_progress', started_at=now()

export async function completeTask(taskId: string): Promise<ActionResult>
// Auth: assigned housekeeper/admin
// Update: status='completed', completed_at=now()
// Trigger updates room_units.status='available'

export async function reportMaintenance(input: {
  room_unit_id: string, issue_type, severity, title, description?
}): Promise<ActionResult>
// Auth: housekeeper, reception, admin
// Insert: new maintenance_reports row
// Side effect: severity='critical' → room_units.status='maintenance'

export async function updateRoomStatus(
  unitId: string, newStatus: 'cleaning' | 'available'
): Promise<ActionResult>
// Auth: housekeeper, reception, admin
// Validate: newStatus in ('cleaning', 'available')
// Update: room_units.status
```

**Test user** (add to CLAUDE.md + seed):
- `somjit@zenzero.com` / `Housekeep123!` — housekeeper

---

## 5. Testing, Success Criteria & Out of Scope

### Manual Test Plan

1. Login as `somjit@zenzero.com` → land on `/housekeeper`
2. Dashboard renders greeting, 4 stats, priority tasks
3. `/housekeeper/rooms` → 12 rooms with badges, dropdown only enabled for cleaning/available
4. Toggle cleaning ↔ available → DB updates
5. `/housekeeper/tasks` → see Unassigned Pool, click Claim → moves to My Tasks
6. Start task → status in_progress, room_units.status='cleaning'
7. Complete task → status completed, room_units.status='available' (verify trigger)
8. `/housekeeper/maintenance` → New Report → submit → row appears
9. Submit critical maintenance → room_units.status='maintenance'
10. `/housekeeper/history` → toggle My/All, table + chart render
11. Login as `somchai@example.com` (user) → `/housekeeper` → redirect `/`
12. Login as `test@zenzero.com` (reception) → `/housekeeper` → redirect `/`
13. Login as housekeeper → `/reception` → redirect `/`

### Success Criteria

- All 5 routes accessible to housekeeper role
- Mock mode (`USE_MOCK_DATA=1`) works without Supabase
- Real mode (`USE_MOCK_DATA=0`) — migrations applied, queries work, RLS prevents cross-role access
- `npm run build` succeeds, no TypeScript errors
- `npm run lint` passes
- Visual match with V1 prototype aesthetic
- Triggers maintain room_units.status consistency

### Out of Scope for Phase 5

- Reception-side UI for creating tasks (Phase 6+)
- Auto-create task on check-out event (Phase 6+)
- Manager role + maintenance resolve flow (future)
- Reviews UI, forgot password, email confirmation
- Image upload to R2
- Housekeeper manual task creation (reception only in Phase 5)

---

## Files

**New files (15)**:
- `supabase/migrations/20260821_housekeeping_tasks.sql`
- `supabase/migrations/20260822_maintenance_reports.sql`
- `supabase/migrations/20260823_housekeeping_rls.sql`
- `app/housekeeper/layout.tsx`
- `app/housekeeper/page.tsx`
- `app/housekeeper/rooms/page.tsx`
- `app/housekeeper/tasks/page.tsx`
- `app/housekeeper/history/page.tsx`
- `app/housekeeper/maintenance/page.tsx`
- `app/actions/housekeeping.ts`
- `lib/data/housekeeper.ts`
- `lib/data/mock-housekeeper.ts`
- `lib/data/supabase-housekeeper.ts`
- `data/mock-housekeeper.json`
- `components/housekeeping/*` (10 components)

**Modified files (3)**:
- `lib/data/types.ts` — add housekeeper types
- `CLAUDE.md` — update test users + Phase 5 complete
- `README.md` — Housekeeper role in features