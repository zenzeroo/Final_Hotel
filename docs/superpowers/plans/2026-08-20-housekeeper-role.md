# Housekeeper Role (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Housekeeper role to Zenzero Hotel — 5 pages, 2 new tables, server actions, mock + real data layers

**Architecture:** Mirror Reception role pattern. New `housekeeping_tasks` + `maintenance_reports` tables, public data layer with mock toggle, 5 server actions for mutations, 5 pages consuming data via Server Components with Client sub-components for interactivity. DB triggers keep `room_units.status` in sync with task lifecycle.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript strict, Tailwind v4 (CSS-based @theme), Supabase (Postgres + Auth + RLS), `@supabase/ssr` server client

**Spec:** `docs/superpowers/specs/2026-08-20-housekeeper-role-design.md`

## Global Constraints

- **Next.js 16 + React 19**: `params`/`searchParams` are Promises (await them); use `PageProps<'/route'>`/`LayoutProps<'/route'>` types; `cookies()` is async — always await
- **Tailwind v4**: All design tokens via `@theme {}` in `app/globals.css` — DO NOT create `tailwind.config.ts`
- **Next.js 16 Proxy**: Use `proxy.ts` at root — DO NOT use `middleware.ts`
- **Design tokens**: Forest Green `#082717` (primary), Warm Gold `#765a26` (secondary), Soft Cream `#faf9f6` (background); Playfair Display (display) + Inter (body); Material Symbols Outlined icons via `components/ui/MaterialIcon.tsx`
- **RLS**: Always use `is_staff()` function in policy subqueries — NEVER query `profiles` directly (causes 42P17 infinite recursion)
- **RLS patterns**: `TO authenticated` + ownership in `USING` (not `auth.role()`); UPDATE needs both `USING` + `WITH CHECK`; use `(select auth.uid())` (subquery) for caching
- **Mock toggle**: `lib/data/housekeeper.ts` checks `USE_MOCK_DATA` env var — same pattern as `lib/data/rooms.ts`
- **Data layer pattern**: Singleton server client via `lib/supabase/server.ts`; no service role key
- **Pages with user data**: Add `export const dynamic = 'force-dynamic'` to prevent build prerender failures
- **Sidebar**: `StaffSidebar` already has `HOUSEKEEPER_NAV` array — do not modify; just pass `role="housekeeper"`
- **Mock JSON file**: 12 rooms, 8-10 tasks, 5-6 maintenance reports, 30+ history records
- **Test user**: `somjit@zenzero.com` / `Housekeep123!` (housekeeper role) — add to Supabase via SQL promotion
- **Per Rule R1** (Rule.md): When solving non-trivial bugs, log them in `CLAUDE.md` → `## Common Pitfalls`

---

## Task 1: Database — Create 3 Migrations

**Files:**
- Create: `supabase/migrations/20260821_housekeeping_tasks.sql`
- Create: `supabase/migrations/20260822_maintenance_reports.sql`
- Create: `supabase/migrations/20260823_housekeeping_rls.sql`

**Interfaces:**
- Produces: tables `public.housekeeping_tasks`, `public.maintenance_reports`; enums `housekeeping_task_type`, `housekeeping_task_status`, `housekeeping_task_priority`, `maintenance_issue_type`, `maintenance_severity`, `maintenance_status`; trigger `trg_task_status` on `housekeeping_tasks`

- [ ] **Step 1: Create housekeeping_tasks migration**

Write `supabase/migrations/20260821_housekeeping_tasks.sql`:

```sql
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
```

- [ ] **Step 2: Create maintenance_reports migration**

Write `supabase/migrations/20260822_maintenance_reports.sql`:

```sql
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
```

- [ ] **Step 3: Create RLS policies migration**

Write `supabase/migrations/20260823_housekeeping_rls.sql`:

```sql
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
```

- [ ] **Step 4: Verify SQL syntactically**

Run: `cat supabase/migrations/20260821_housekeeping_tasks.sql supabase/migrations/20260822_maintenance_reports.sql supabase/migrations/20260823_housekeeping_rls.sql | head -200`
Expected: All three files concatenated display without parse errors

- [ ] **Step 5: Commit migrations**

```bash
git add supabase/migrations/20260821_housekeeping_tasks.sql supabase/migrations/20260822_maintenance_reports.sql supabase/migrations/20260823_housekeeping_rls.sql
git commit -m "feat(db): housekeeping_tasks + maintenance_reports tables, RLS, triggers"
```

---

## Task 2: Apply Migrations to Supabase

**Files:** (no code changes)

**Interfaces:** Database tables `housekeeping_tasks`, `maintenance_reports` are live in Supabase

- [ ] **Step 1: Apply migration 1**

Run: `node scripts/run-sql.mjs supabase/migrations/20260821_housekeeping_tasks.sql`
Expected: Output ends with success message; check Supabase Dashboard → Table Editor shows `housekeeping_tasks`

- [ ] **Step 2: Apply migration 2**

Run: `node scripts/run-sql.mjs supabase/migrations/20260822_maintenance_reports.sql`
Expected: `maintenance_reports` table visible

- [ ] **Step 3: Apply migration 3**

Run: `node scripts/run-sql.mjs supabase/migrations/20260823_housekeeping_rls.sql`
Expected: RLS policies applied; try selecting via anon key — should return empty for non-staff

- [ ] **Step 4: Create housekeeper test user**

Via Supabase Dashboard → Authentication → Users → "Add user" with email `somjit@zenzero.com`, password `Housekeep123!`, auto-confirm.

Then run via Supabase SQL Editor:
```sql
update public.profiles set role = 'housekeeper' where id = (select id from auth.users where email = 'somjit@zenzero.com');
```

- [ ] **Step 5: Verify role**

Run: `node -e "const {createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);c.from('profiles').select('role').eq('email','somjit@zenzero.com').single().then(r=>console.log(r.data))"`
Expected: `{ role: 'housekeeper' }`

- [ ] **Step 6: Commit any updated seed files**

```bash
git status
# if seed*.sql modified:
git add supabase/seed*.sql
git commit -m "chore(db): promote somjit@zenzero.com to housekeeper role" || echo "No seed changes"
```

---

## Task 3: Types + Mock Data JSON

**Files:**
- Modify: `lib/data/types.ts` — add housekeeper types
- Create: `data/mock-housekeeper.json` — mock data

**Interfaces:**
- Produces: types `HousekeepingTask`, `HousekeepingTaskType`, `HousekeepingTaskStatus`, `HousekeepingTaskPriority`, `MaintenanceReport`, `MaintenanceIssueType`, `MaintenanceSeverity`, `MaintenanceStatus`, `RoomUnitStatus`; JSON mock file

- [ ] **Step 1: Add types to lib/data/types.ts**

Read `lib/data/types.ts` first to see existing patterns, then add at end:

```typescript
// =====================================================
// Housekeeping types
// =====================================================
export type HousekeepingTaskType = 'cleaning' | 'turn_down' | 'deep_clean' | 'inspection' | 'restock'
export type HousekeepingTaskStatus = 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type HousekeepingTaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface RoomUnitBasic {
  id: string
  floor: number
  unit_label: string
  view_label: string | null
  status: RoomUnitStatus
  room_type?: {
    id: string
    name: string
    name_th: string | null
    hero_image_key: string | null
  }
}

export type RoomUnitStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order'

export interface HousekeepingTask {
  id: string
  room_unit_id: string
  task_type: HousekeepingTaskType
  priority: HousekeepingTaskPriority
  status: HousekeepingTaskStatus
  assigned_to: string | null
  created_by: string
  booking_id: string | null
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  room_unit?: RoomUnitBasic
  assigned_user?: { full_name: string | null } | null
  created_user?: { full_name: string | null } | null
}

// =====================================================
// Maintenance types
// =====================================================
export type MaintenanceIssueType = 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'other'
export type MaintenanceSeverity = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'

export interface MaintenanceReport {
  id: string
  room_unit_id: string
  issue_type: MaintenanceIssueType
  severity: MaintenanceSeverity
  status: MaintenanceStatus
  title: string
  description: string | null
  reported_by: string
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  room_unit?: RoomUnitBasic
  reporter?: { full_name: string | null } | null
}

export interface DashboardStats {
  roomsToClean: number
  shiftProgress: number  // 0-100
  myTasksCount: number
  maintenanceOpenCount: number
  priorityTasks: HousekeepingTask[]
  activeTasks: HousekeepingTask[]
}

export interface WorkHistoryData {
  roomsCleaned: number
  avgMinutes: number | null
  tasksToday: number
  tasksThisWeek: number
  dailyPerformance: { date: string; count: number }[]  // last 7 days
  recentLog: HousekeepingTask[]
}
```

- [ ] **Step 2: Create mock-housekeeper.json**

Write `data/mock-housekeeper.json`:

```json
{
  "tasks": [
    {
      "id": "t-001",
      "room_unit_id": "u-001",
      "task_type": "cleaning",
      "priority": "high",
      "status": "unassigned",
      "assigned_to": null,
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": "Guest checked out at 11:30",
      "started_at": null,
      "completed_at": null,
      "created_at": "2026-08-20T09:00:00Z",
      "updated_at": "2026-08-20T09:00:00Z"
    },
    {
      "id": "t-002",
      "room_unit_id": "u-003",
      "task_type": "cleaning",
      "priority": "normal",
      "status": "unassigned",
      "assigned_to": null,
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": null,
      "completed_at": null,
      "created_at": "2026-08-20T09:15:00Z",
      "updated_at": "2026-08-20T09:15:00Z"
    },
    {
      "id": "t-003",
      "room_unit_id": "u-005",
      "task_type": "turn_down",
      "priority": "low",
      "status": "assigned",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": "Evening turn-down service",
      "started_at": null,
      "completed_at": null,
      "created_at": "2026-08-20T08:00:00Z",
      "updated_at": "2026-08-20T08:00:00Z"
    },
    {
      "id": "t-004",
      "room_unit_id": "u-007",
      "task_type": "inspection",
      "priority": "high",
      "status": "assigned",
      "assigned_to": "u-house-1",
      "created_by": "u-admin-1",
      "booking_id": null,
      "notes": "VIP suite — verify minibar stocked",
      "started_at": null,
      "completed_at": null,
      "created_at": "2026-08-20T07:30:00Z",
      "updated_at": "2026-08-20T07:30:00Z"
    },
    {
      "id": "t-005",
      "room_unit_id": "u-002",
      "task_type": "cleaning",
      "priority": "normal",
      "status": "in_progress",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": "2026-08-20T08:30:00Z",
      "completed_at": null,
      "created_at": "2026-08-20T08:00:00Z",
      "updated_at": "2026-08-20T08:30:00Z"
    },
    {
      "id": "t-006",
      "room_unit_id": "u-009",
      "task_type": "deep_clean",
      "priority": "normal",
      "status": "completed",
      "assigned_to": "u-house-2",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": "Monthly deep clean",
      "started_at": "2026-08-20T06:00:00Z",
      "completed_at": "2026-08-20T08:00:00Z",
      "created_at": "2026-08-20T05:30:00Z",
      "updated_at": "2026-08-20T08:00:00Z"
    },
    {
      "id": "t-007",
      "room_unit_id": "u-004",
      "task_type": "cleaning",
      "priority": "urgent",
      "status": "completed",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": "Rushed for incoming guest at 14:00",
      "started_at": "2026-08-20T07:00:00Z",
      "completed_at": "2026-08-20T07:45:00Z",
      "created_at": "2026-08-20T06:30:00Z",
      "updated_at": "2026-08-20T07:45:00Z"
    },
    {
      "id": "t-008",
      "room_unit_id": "u-006",
      "task_type": "restock",
      "priority": "low",
      "status": "completed",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": "Towels + toiletries",
      "started_at": "2026-08-19T15:00:00Z",
      "completed_at": "2026-08-19T15:20:00Z",
      "created_at": "2026-08-19T14:30:00Z",
      "updated_at": "2026-08-19T15:20:00Z"
    },
    {
      "id": "t-009",
      "room_unit_id": "u-008",
      "task_type": "cleaning",
      "priority": "normal",
      "status": "completed",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": "2026-08-19T09:00:00Z",
      "completed_at": "2026-08-19T09:50:00Z",
      "created_at": "2026-08-19T08:30:00Z",
      "updated_at": "2026-08-19T09:50:00Z"
    },
    {
      "id": "t-010",
      "room_unit_id": "u-010",
      "task_type": "cleaning",
      "priority": "normal",
      "status": "completed",
      "assigned_to": "u-house-2",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": "2026-08-19T08:00:00Z",
      "completed_at": "2026-08-19T08:40:00Z",
      "created_at": "2026-08-19T07:30:00Z",
      "updated_at": "2026-08-19T08:40:00Z"
    },
    {
      "id": "t-011",
      "room_unit_id": "u-011",
      "task_type": "cleaning",
      "priority": "normal",
      "status": "completed",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": "2026-08-18T10:00:00Z",
      "completed_at": "2026-08-18T10:45:00Z",
      "created_at": "2026-08-18T09:30:00Z",
      "updated_at": "2026-08-18T10:45:00Z"
    },
    {
      "id": "t-012",
      "room_unit_id": "u-012",
      "task_type": "turn_down",
      "priority": "low",
      "status": "completed",
      "assigned_to": "u-house-1",
      "created_by": "u-recep-1",
      "booking_id": null,
      "notes": null,
      "started_at": "2026-08-18T18:00:00Z",
      "completed_at": "2026-08-18T18:15:00Z",
      "created_at": "2026-08-18T17:30:00Z",
      "updated_at": "2026-08-18T18:15:00Z"
    }
  ],
  "maintenance_reports": [
    {
      "id": "m-001",
      "room_unit_id": "u-003",
      "issue_type": "plumbing",
      "severity": "high",
      "status": "open",
      "title": "Sink draining slowly",
      "description": "Bathroom sink takes 3+ minutes to drain. Guest complained.",
      "reported_by": "u-house-1",
      "assigned_to": null,
      "resolved_at": null,
      "created_at": "2026-08-20T07:30:00Z",
      "updated_at": "2026-08-20T07:30:00Z"
    },
    {
      "id": "m-002",
      "room_unit_id": "u-005",
      "issue_type": "hvac",
      "severity": "critical",
      "status": "open",
      "title": "AC unit not cooling",
      "description": "AC running but blowing warm air. Room unusable for guests.",
      "reported_by": "u-house-1",
      "assigned_to": null,
      "resolved_at": null,
      "created_at": "2026-08-20T08:15:00Z",
      "updated_at": "2026-08-20T08:15:00Z"
    },
    {
      "id": "m-003",
      "room_unit_id": "u-007",
      "issue_type": "furniture",
      "severity": "low",
      "status": "open",
      "title": "Drawer handle loose",
      "description": "Top drawer of bedside table handle is loose but functional.",
      "reported_by": "u-house-2",
      "assigned_to": null,
      "resolved_at": null,
      "created_at": "2026-08-20T06:00:00Z",
      "updated_at": "2026-08-20T06:00:00Z"
    },
    {
      "id": "m-004",
      "room_unit_id": "u-009",
      "issue_type": "electrical",
      "severity": "medium",
      "status": "in_progress",
      "title": "Bedside lamp flickering",
      "description": "Left bedside lamp flickers intermittently. Bulb replaced but issue persists — likely wiring.",
      "reported_by": "u-recep-1",
      "assigned_to": null,
      "resolved_at": null,
      "created_at": "2026-08-19T14:00:00Z",
      "updated_at": "2026-08-19T16:00:00Z"
    },
    {
      "id": "m-005",
      "room_unit_id": "u-011",
      "issue_type": "appliance",
      "severity": "low",
      "status": "resolved",
      "title": "Coffee maker leaking",
      "description": "Drip tray overflow during brewing. Replaced unit.",
      "reported_by": "u-house-1",
      "assigned_to": null,
      "resolved_at": "2026-08-19T11:00:00Z",
      "created_at": "2026-08-19T09:30:00Z",
      "updated_at": "2026-08-19T11:00:00Z"
    }
  ]
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('data/mock-housekeeper.json','utf8')).tasks.length)"`
Expected: `12`

- [ ] **Step 4: Commit types + mock data**

```bash
git add lib/data/types.ts data/mock-housekeeper.json
git commit -m "feat(data): housekeeper + maintenance types, mock JSON (12 tasks, 5 reports)"
```

---

## Task 4: Data Layer (lib/data/housekeeper.ts)

**Files:**
- Create: `lib/data/housekeeper.ts` — public interface with USE_MOCK_DATA toggle
- Create: `lib/data/mock-housekeeper.ts` — reads JSON
- Create: `lib/data/supabase-housekeeper.ts` — real queries

**Interfaces:**
- Consumes: types from `lib/data/types.ts`, mock from `data/mock-housekeeper.json`
- Produces: exported functions: `getMyTasks`, `getUnassignedTasks`, `getTaskById`, `getMaintenanceReports`, `getMyDashboardStats`, `getMyWorkHistory`, `getAllRoomUnits`, `getAllWorkHistory`

- [ ] **Step 1: Create mock-housekeeper.ts**

Write `lib/data/mock-housekeeper.ts`:

```typescript
import type {
  HousekeepingTask, MaintenanceReport, RoomUnitBasic,
  DashboardStats, WorkHistoryData, HousekeepingTaskStatus,
  MaintenanceStatus, MaintenanceSeverity,
} from './types'
import mockData from '@/data/mock-housekeeper.json'

// Minimal room units mock (12 rooms matching seed)
const MOCK_ROOM_UNITS: RoomUnitBasic[] = [
  { id: 'u-001', floor: 1, unit_label: '101', view_label: 'Garden View', status: 'cleaning', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-002', floor: 1, unit_label: '102', view_label: 'Pool View', status: 'cleaning', room_type: { id: 'rt-002', name: 'Deluxe Pool', name_th: 'ดีลักซ์ พูล', hero_image_key: 'rooms/deluxe-pool-1.jpg' }},
  { id: 'u-003', floor: 2, unit_label: '201', view_label: 'Garden View', status: 'cleaning', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-004', floor: 2, unit_label: '202', view_label: 'Garden View', status: 'available', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-005', floor: 2, unit_label: '203', view_label: 'Pool View', status: 'maintenance', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
  { id: 'u-006', floor: 3, unit_label: '301', view_label: 'City View', status: 'available', room_type: { id: 'rt-004', name: 'Premier City', name_th: 'พรีเมียร์ ซิตี้', hero_image_key: 'rooms/premier-city-1.jpg' }},
  { id: 'u-007', floor: 3, unit_label: '302', view_label: 'City View', status: 'available', room_type: { id: 'rt-005', name: 'VIP Suite', name_th: 'วีไอพี สวีท', hero_image_key: 'rooms/vip-suite-1.jpg' }},
  { id: 'u-008', floor: 3, unit_label: '303', view_label: 'Pool View', status: 'available', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
  { id: 'u-009', floor: 4, unit_label: '401', view_label: 'City View', status: 'available', room_type: { id: 'rt-004', name: 'Premier City', name_th: 'พรีเมียร์ ซิตี้', hero_image_key: 'rooms/premier-city-1.jpg' }},
  { id: 'u-010', floor: 4, unit_label: '402', view_label: 'City View', status: 'occupied', room_type: { id: 'rt-005', name: 'VIP Suite', name_th: 'วีไอพี สวีท', hero_image_key: 'rooms/vip-suite-1.jpg' }},
  { id: 'u-011', floor: 4, unit_label: '403', view_label: 'Garden View', status: 'available', room_type: { id: 'rt-001', name: 'Deluxe Garden', name_th: 'ดีลักซ์ การ์เดน', hero_image_key: 'rooms/deluxe-garden-1.jpg' }},
  { id: 'u-012', floor: 4, unit_label: '404', view_label: 'Pool View', status: 'occupied', room_type: { id: 'rt-003', name: 'Suite Pool', name_th: 'สวีท พูล', hero_image_key: 'rooms/suite-pool-1.jpg' }},
]

const MOCK_USERS = {
  'u-house-1': { full_name: 'Somjit (You)' },
  'u-house-2': { full_name: 'Niran' },
  'u-recep-1': { full_name: 'Malee' },
  'u-admin-1': { full_name: 'Admin' },
}

function enrichTask(t: HousekeepingTask): HousekeepingTask {
  return {
    ...t,
    room_unit: MOCK_ROOM_UNITS.find(u => u.id === t.room_unit_id),
    assigned_user: t.assigned_to ? MOCK_USERS[t.assigned_to as keyof typeof MOCK_USERS] ?? null : null,
    created_user: MOCK_USERS[t.created_by as keyof typeof MOCK_USERS] ?? null,
  }
}

function enrichReport(r: MaintenanceReport): MaintenanceReport {
  return {
    ...r,
    room_unit: MOCK_ROOM_UNITS.find(u => u.id === r.room_unit_id),
    reporter: MOCK_USERS[r.reported_by as keyof typeof MOCK_USERS] ?? null,
  }
}

const CURRENT_USER_ID = 'u-house-1'

export async function getMyTasks(): Promise<HousekeepingTask[]> {
  const tasks = (mockData.tasks as HousekeepingTask[]).filter(
    t => t.assigned_to === CURRENT_USER_ID && t.status !== 'completed' && t.status !== 'cancelled'
  )
  return tasks.map(enrichTask)
}

export async function getUnassignedTasks(): Promise<HousekeepingTask[]> {
  const tasks = (mockData.tasks as HousekeepingTask[]).filter(t => t.status === 'unassigned')
  return tasks.map(enrichTask)
}

export async function getMaintenanceReports(filters?: {
  status?: MaintenanceStatus[]; severity?: MaintenanceSeverity[]
}): Promise<MaintenanceReport[]> {
  let reports = mockData.maintenance_reports as MaintenanceReport[]
  if (filters?.status?.length) reports = reports.filter(r => filters.status!.includes(r.status))
  if (filters?.severity?.length) reports = reports.filter(r => filters.severity!.includes(r.severity))
  return reports.map(enrichReport).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getMyDashboardStats(): Promise<DashboardStats> {
  const allTasks = (mockData.tasks as HousekeepingTask[]).map(enrichTask)
  const roomsToClean = MOCK_ROOM_UNITS.filter(u => u.status === 'cleaning').length
  const myTasksCount = allTasks.filter(t => t.assigned_to === CURRENT_USER_ID && t.status !== 'completed').length
  const maintenanceOpenCount = (mockData.maintenance_reports as MaintenanceReport[]).filter(r => r.status === 'open').length
  const myCompletedToday = allTasks.filter(t => t.assigned_to === CURRENT_USER_ID && t.status === 'completed' && t.completed_at?.startsWith('2026-08-20')).length
  const shiftProgress = Math.round((myCompletedToday / 12) * 100)
  const priorityTasks = allTasks
    .filter(t => t.priority === 'urgent' || t.priority === 'high')
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => ({ urgent: 3, high: 2, normal: 1, low: 0 }[b.priority] - { urgent: 3, high: 2, normal: 1, low: 0 }[a.priority]))
    .slice(0, 5)
  const activeTasks = allTasks
    .filter(t => t.assigned_to === CURRENT_USER_ID && (t.status === 'assigned' || t.status === 'in_progress'))

  return { roomsToClean, shiftProgress, myTasksCount, maintenanceOpenCount, priorityTasks, activeTasks }
}

export async function getAllRoomUnits(): Promise<RoomUnitBasic[]> {
  return MOCK_ROOM_UNITS
}

export async function getMyWorkHistory(): Promise<WorkHistoryData> {
  return computeHistory(CURRENT_USER_ID)
}

export async function getAllWorkHistory(): Promise<WorkHistoryData> {
  return computeHistory(null)
}

function computeHistory(userId: string | null): WorkHistoryData {
  const completed = (mockData.tasks as HousekeepingTask[]).filter(
    t => t.status === 'completed' && (!userId || t.assigned_to === userId)
  )
  const roomsCleaned = completed.length
  const durations = completed
    .filter(t => t.started_at && t.completed_at)
    .map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000)
  const avgMinutes = durations.length ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null
  const tasksToday = completed.filter(t => t.completed_at?.startsWith('2026-08-20')).length
  const tasksThisWeek = completed.filter(t => {
    const d = new Date(t.completed_at!).getTime()
    const weekAgo = Date.now() - 7 * 86400000
    return d > weekAgo
  }).length

  // Last 7 days
  const dailyPerformance: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const count = completed.filter(t => t.completed_at?.startsWith(dateStr)).length
    dailyPerformance.push({ date: dateStr.slice(5), count })  // MM-DD
  }

  const recentLog = completed
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 20)
    .map(enrichTask)

  return { roomsCleaned, avgMinutes, tasksToday, tasksThisWeek, dailyPerformance, recentLog }
}
```

- [ ] **Step 2: Create supabase-housekeeper.ts**

Write `lib/data/supabase-housekeeper.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type {
  HousekeepingTask, MaintenanceReport, RoomUnitBasic,
  DashboardStats, WorkHistoryData, HousekeepingTaskStatus,
  MaintenanceStatus, MaintenanceSeverity,
} from './types'

export async function getMyTasks(userId: string): Promise<HousekeepingTask[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key)),
      assigned_user:profiles!housekeeping_tasks_assigned_to_fkey(full_name),
      created_user:profiles!housekeeping_tasks_created_by_fkey(full_name)
    `)
    .eq('assigned_to', userId)
    .in('status', ['assigned', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as HousekeepingTask[]
}

export async function getUnassignedTasks(): Promise<HousekeepingTask[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `)
    .eq('status', 'unassigned')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as HousekeepingTask[]
}

export async function getMaintenanceReports(filters?: {
  status?: MaintenanceStatus[]; severity?: MaintenanceSeverity[]
}): Promise<MaintenanceReport[]> {
  const supabase = await createClient()
  let query = supabase
    .from('maintenance_reports')
    .select(`
      *,
      room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key)),
      reporter:profiles!maintenance_reports_reported_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
  if (filters?.status?.length) query = query.in('status', filters.status)
  if (filters?.severity?.length) query = query.in('severity', filters.severity)
  const { data, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as MaintenanceReport[]
}

export async function getMyDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createClient()
  const [cleaningCount, myCount, maintCount, myTasks, priorityTasks] = await Promise.all([
    supabase.from('room_units').select('id', { count: 'exact', head: true }).eq('status', 'cleaning'),
    supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId).in('status', ['assigned', 'in_progress']),
    supabase.from('maintenance_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('housekeeping_tasks').select(`
      *, room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `).eq('assigned_to', userId).in('status', ['assigned', 'in_progress']),
    supabase.from('housekeeping_tasks').select(`
      *, room_unit:room_units(id, floor, unit_label, view_label, status,
        room_type:room_types(id, name, name_th, hero_image_key))
    `).in('priority', ['urgent', 'high']).in('status', ['unassigned', 'assigned', 'in_progress'])
      .order('priority', { ascending: false }).limit(5),
  ])
  if (cleaningCount.error) throw new Error(cleaningCount.error.message)
  if (maintCount.error) throw new Error(maintCount.error.message)

  const today = new Date().toISOString().slice(0, 10)
  const completedTodayRes = await supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId).eq('status', 'completed').gte('completed_at', `${today}T00:00:00Z`)
  if (completedTodayRes.error) throw new Error(completedTodayRes.error.message)
  const shiftProgress = Math.round(((completedTodayRes.count ?? 0) / 12) * 100)

  return {
    roomsToClean: cleaningCount.count ?? 0,
    shiftProgress,
    myTasksCount: myCount.count ?? 0,
    maintenanceOpenCount: maintCount.count ?? 0,
    priorityTasks: (priorityTasks.data ?? []) as HousekeepingTask[],
    activeTasks: (myTasks.data ?? []) as HousekeepingTask[],
  }
}

export async function getAllRoomUnits(): Promise<RoomUnitBasic[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_units')
    .select(`
      id, floor, unit_label, view_label, status,
      room_type:room_types(id, name, name_th, hero_image_key)
    `)
    .eq('is_active', true)
    .order('floor').order('unit_label')
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as RoomUnitBasic[]
}

export async function getMyWorkHistory(userId: string): Promise<WorkHistoryData> {
  return computeHistory(userId)
}

export async function getAllWorkHistory(): Promise<WorkHistoryData> {
  return computeHistory(null)
}

async function computeHistory(userId: string | null): Promise<WorkHistoryData> {
  const supabase = await createClient()
  let query = supabase.from('housekeeping_tasks').select(`
    id, task_type, priority, status, started_at, completed_at, room_unit_id,
    room_unit:room_units(id, floor, unit_label, view_label, status,
      room_type:room_types(id, name, name_th, hero_image_key))
  `).eq('status', 'completed').order('completed_at', { ascending: false }).limit(200)
  if (userId) query = query.eq('assigned_to', userId)
  const { data, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)
  const completed = (data ?? []) as HousekeepingTask[]

  const roomsCleaned = completed.length
  const durations = completed
    .filter(t => t.started_at && t.completed_at)
    .map(t => (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 60000)
  const avgMinutes = durations.length ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length) : null
  const today = new Date().toISOString().slice(0, 10)
  const tasksToday = completed.filter(t => t.completed_at?.startsWith(today)).length
  const tasksThisWeek = completed.filter(t => {
    if (!t.completed_at) return false
    return Date.now() - new Date(t.completed_at).getTime() < 7 * 86400000
  }).length

  const dailyPerformance: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const count = completed.filter(t => t.completed_at?.startsWith(d)).length
    dailyPerformance.push({ date: d.slice(5), count })
  }

  return {
    roomsCleaned, avgMinutes, tasksToday, tasksThisWeek,
    dailyPerformance,
    recentLog: completed.slice(0, 20),
  }
}
```

- [ ] **Step 3: Create housekeeper.ts (public interface)**

Write `lib/data/housekeeper.ts`:

```typescript
import * as mock from './mock-housekeeper'
import * as real from './supabase-housekeeper'

const useMock = process.env.USE_MOCK_DATA === '1' || process.env.USE_MOCK_DATA === 'true'

export const getMyTasks = useMock ? mock.getMyTasks : () => {
  throw new Error('getMyTasks requires userId — use the version from supabase-housekeeper')
}

export const getUnassignedTasks = useMock ? mock.getUnassignedTasks : real.getUnassignedTasks

export const getMaintenanceReports = useMock
  ? mock.getMaintenanceReports
  : real.getMaintenanceReports

export const getMyDashboardStats = useMock
  ? mock.getMyDashboardStats
  : () => {
    throw new Error('getMyDashboardStats requires userId — use the version from supabase-housekeeper')
  }

export const getAllRoomUnits = useMock ? mock.getAllRoomUnits : real.getAllRoomUnits

export const getMyWorkHistory = useMock ? mock.getMyWorkHistory : () => {
  throw new Error('getMyWorkHistory requires userId — use the version from supabase-housekeeper')
}

export const getAllWorkHistory = useMock ? mock.getAllWorkHistory : real.getAllWorkHistory

// Real-mode wrappers that pass userId
export async function getMyTasksForUser(userId: string) {
  if (useMock) return mock.getMyTasks()
  return real.getMyTasks(userId)
}

export async function getMyDashboardStatsForUser(userId: string) {
  if (useMock) return mock.getMyDashboardStats()
  return real.getMyDashboardStats(userId)
}

export async function getMyWorkHistoryForUser(userId: string) {
  if (useMock) return mock.getMyWorkHistory()
  return real.getMyWorkHistory(userId)
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit data layer**

```bash
git add lib/data/housekeeper.ts lib/data/mock-housekeeper.ts lib/data/supabase-housekeeper.ts
git commit -m "feat(data): housekeeper data layer with mock + supabase implementations"
```

---

## Task 5: Server Actions

**Files:**
- Create: `app/actions/housekeeping.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server`, types from `lib/data/types`
- Produces: exported async functions: `claimTask`, `startTask`, `completeTask`, `reportMaintenance`, `updateRoomStatus` — all return `ActionResult<T>`

- [ ] **Step 1: Create server actions file**

Write `app/actions/housekeeping.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/supabase/getSession'
import type { MaintenanceIssueType, MaintenanceSeverity } from '@/lib/data/types'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

async function requireStaff() {
  const session = await getSession()
  if (!session) redirect('/login?next=/housekeeper')
  if (!['housekeeper', 'reception', 'admin'].includes(session.role)) {
    redirect('/')
  }
  return session
}

export async function claimTask(taskId: string): Promise<ActionResult> {
  const session = await requireStaff()
  if (session.role !== 'housekeeper' && session.role !== 'admin') {
    return { ok: false, error: 'Only housekeeper can claim tasks' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'assigned', assigned_to: session.userId, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'unassigned')
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Task already claimed or not found' }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  return { ok: true }
}

export async function startTask(taskId: string): Promise<ActionResult> {
  const session = await requireStaff()
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('housekeeping_tasks')
    .select('assigned_to, status')
    .eq('id', taskId)
    .single()

  if (fetchErr || !task) return { ok: false, error: 'Task not found' }
  if (task.assigned_to !== session.userId && session.role !== 'admin' && session.role !== 'reception') {
    return { ok: false, error: 'Not authorized for this task' }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'in_progress', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'assigned')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function completeTask(taskId: string): Promise<ActionResult> {
  const session = await requireStaff()
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('housekeeping_tasks')
    .select('assigned_to, status')
    .eq('id', taskId)
    .single()

  if (fetchErr || !task) return { ok: false, error: 'Task not found' }
  if (task.assigned_to !== session.userId && session.role !== 'admin' && session.role !== 'reception') {
    return { ok: false, error: 'Not authorized for this task' }
  }
  if (task.status !== 'in_progress') {
    return { ok: false, error: 'Task must be in progress to complete' }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'in_progress')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/tasks')
  revalidatePath('/housekeeper/rooms')
  revalidatePath('/housekeeper/history')
  return { ok: true }
}

export async function reportMaintenance(input: {
  room_unit_id: string
  issue_type: MaintenanceIssueType
  severity: MaintenanceSeverity
  title: string
  description?: string
}): Promise<ActionResult> {
  const session = await requireStaff()
  const supabase = await createClient()

  if (!input.title?.trim()) return { ok: false, error: 'Title required' }
  if (!input.room_unit_id) return { ok: false, error: 'Room required' }

  const { error } = await supabase.from('maintenance_reports').insert({
    room_unit_id: input.room_unit_id,
    issue_type: input.issue_type,
    severity: input.severity,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    reported_by: session.userId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper')
  revalidatePath('/housekeeper/maintenance')
  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}

export async function updateRoomStatus(
  unitId: string,
  newStatus: 'cleaning' | 'available'
): Promise<ActionResult> {
  await requireStaff()
  const supabase = await createClient()

  if (!['cleaning', 'available'].includes(newStatus)) {
    return { ok: false, error: 'Invalid status. Only cleaning ↔ available allowed' }
  }

  const { error } = await supabase
    .from('room_units')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', unitId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/housekeeper/rooms')
  return { ok: true }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Verify session helper exists**

Run: `grep -l "getSession" lib/supabase/getSession.ts`
Expected: path printed

- [ ] **Step 4: Commit actions**

```bash
git add app/actions/housekeeping.ts
git commit -m "feat(actions): housekeeper server actions (claim/start/complete/report/status)"
```

---

## Task 6: Badge Components

**Files:**
- Create: `components/housekeeping/PriorityBadge.tsx`
- Create: `components/housekeeping/StatusBadge.tsx`
- Create: `components/housekeeping/SeverityBadge.tsx`

**Interfaces:**
- Consumes: types `HousekeepingTaskPriority`, `HousekeepingTaskStatus`, `MaintenanceSeverity` from `lib/data/types`
- Produces: exported `<PriorityBadge priority={...}>`, `<StatusBadge status={...}>`, `<SeverityBadge severity={...}>` — server components

- [ ] **Step 1: Create PriorityBadge.tsx**

Write `components/housekeeping/PriorityBadge.tsx`:

```tsx
import type { HousekeepingTaskPriority } from '@/lib/data/types'

const STYLES: Record<HousekeepingTaskPriority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', label: 'Low' },
  normal: { bg: 'bg-secondary-container/40', text: 'text-secondary', label: 'Normal' },
  high: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', label: 'High' },
  urgent: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Urgent' },
}

export function PriorityBadge({ priority }: { priority: HousekeepingTaskPriority }) {
  const s = STYLES[priority]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}
```

- [ ] **Step 2: Create StatusBadge.tsx**

Write `components/housekeeping/StatusBadge.tsx`:

```tsx
import type { HousekeepingTaskStatus, MaintenanceStatus } from '@/lib/data/types'

type AnyStatus = HousekeepingTaskStatus | MaintenanceStatus

const STYLES: Record<AnyStatus, { bg: string; text: string; label: string }> = {
  unassigned: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Unassigned' },
  assigned: { bg: 'bg-secondary-container/40', text: 'text-secondary', label: 'Assigned' },
  in_progress: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', label: 'In Progress' },
  completed: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'Completed' },
  cancelled: { bg: 'bg-surface-container', text: 'text-on-surface-variant', label: 'Cancelled' },
  open: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Open' },
  resolved: { bg: 'bg-primary-container', text: 'text-on-primary-container', label: 'Resolved' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}
```

- [ ] **Step 3: Create SeverityBadge.tsx**

Write `components/housekeeping/SeverityBadge.tsx`:

```tsx
import type { MaintenanceSeverity } from '@/lib/data/types'

const STYLES: Record<MaintenanceSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-surface-container-low', text: 'text-on-surface-variant', label: 'Low' },
  medium: { bg: 'bg-secondary-container/40', text: 'text-secondary', label: 'Medium' },
  high: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', label: 'High' },
  critical: { bg: 'bg-error-container', text: 'text-on-error-container', label: 'Critical' },
}

export function SeverityBadge({ severity }: { severity: MaintenanceSeverity }) {
  const s = STYLES[severity]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit badges**

```bash
git add components/housekeeping/PriorityBadge.tsx components/housekeeping/StatusBadge.tsx components/housekeeping/SeverityBadge.tsx
git commit -m "feat(components): housekeeper badge components (priority, status, severity)"
```

---

## Task 7: Task Components (TaskCard + TaskClaimButton)

**Files:**
- Create: `components/housekeeping/TaskCard.tsx` (server)
- Create: `components/housekeeping/TaskClaimButton.tsx` (client)

**Interfaces:**
- Consumes: types `HousekeepingTask`, badge components
- Produces: `<TaskCard task={...} showActions={...}>`, `<TaskClaimButton taskId={...}>`

- [ ] **Step 1: Create TaskCard.tsx**

Write `components/housekeeping/TaskCard.tsx`:

```tsx
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { TaskClaimButton } from './TaskClaimButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { HousekeepingTask } from '@/lib/data/types'

const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  turn_down: 'Turn-down',
  deep_clean: 'Deep Clean',
  inspection: 'Inspection',
  restock: 'Restock',
}

interface Props {
  task: HousekeepingTask
  variant?: 'my' | 'unassigned' | 'history'
}

export function TaskCard({ task, variant = 'my' }: Props) {
  const unit = task.room_unit
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="font-headline-sm text-headline-sm text-primary">
            {unit ? `Room ${unit.unit_label}` : `Unit ${task.room_unit_id}`}
          </h4>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        <p className="text-body-md text-on-surface-variant">
          {TASK_TYPE_LABELS[task.task_type] ?? task.task_type}
          {unit?.view_label ? ` · ${unit.view_label}` : ''}
          {unit?.room_type?.name ? ` · ${unit.room_type.name}` : ''}
        </p>
        {task.notes && (
          <p className="text-caption text-on-surface-variant mt-2 italic">"{task.notes}"</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-caption text-on-surface-variant">
          {task.started_at && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="play_arrow" size={14} />
              {new Date(task.started_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {task.completed_at && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="check" size={14} />
              {new Date(task.completed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {variant === 'unassigned' && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" size={14} />
              {new Date(task.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>
      </div>
      {variant === 'unassigned' && (
        <TaskClaimButton taskId={task.id} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create TaskClaimButton.tsx (Client)**

Write `components/housekeeping/TaskClaimButton.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { claimTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export function TaskClaimButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Claim this task?')) return
    startTransition(async () => {
      const result = await claimTask(taskId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-4 py-2 bg-primary text-secondary rounded-md font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      <MaterialIcon name="add_task" size={18} />
      {isPending ? 'Claiming...' : 'Claim'}
    </button>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit task components**

```bash
git add components/housekeeping/TaskCard.tsx components/housekeeping/TaskClaimButton.tsx
git commit -m "feat(components): TaskCard + TaskClaimButton"
```

---

## Task 8: Room Status Components

**Files:**
- Create: `components/housekeeping/RoomStatusCard.tsx` (server)
- Create: `components/housekeeping/RoomStatusDropdown.tsx` (client)

**Interfaces:**
- Consumes: type `RoomUnitBasic`, server action `updateRoomStatus`
- Produces: `<RoomStatusCard unit={...}>`, `<RoomStatusDropdown unitId={...} currentStatus={...}>`

- [ ] **Step 1: Create RoomStatusCard.tsx**

Write `components/housekeeping/RoomStatusCard.tsx`:

```tsx
import { StatusBadge } from './StatusBadge'
import { RoomStatusDropdown } from './RoomStatusDropdown'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { RoomUnitBasic } from '@/lib/data/types'

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  out_of_order: 'Out of Order',
}

export function RoomStatusCard({ unit }: { unit: RoomUnitBasic }) {
  const canEdit = unit.status === 'cleaning' || unit.status === 'available'

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-caption text-on-surface-variant uppercase tracking-wider">Floor {unit.floor}</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-primary">
            Room {unit.unit_label}
          </h3>
          {unit.room_type && (
            <p className="text-body-md text-on-surface-variant mt-1">
              {unit.room_type.name}
              {unit.view_label ? ` · ${unit.view_label}` : ''}
            </p>
          )}
        </div>
        <StatusBadge status={unit.status as any} />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/30">
        <span className="text-caption text-on-surface-variant">
          {canEdit ? 'Toggle status' : 'Read-only (reception controls)'}
        </span>
        {canEdit ? (
          <RoomStatusDropdown unitId={unit.id} currentStatus={unit.status as 'cleaning' | 'available'} />
        ) : (
          <MaterialIcon name="lock" size={18} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create RoomStatusDropdown.tsx (Client)**

Write `components/housekeeping/RoomStatusDropdown.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { updateRoomStatus } from '@/app/actions/housekeeping'

export function RoomStatusDropdown({
  unitId,
  currentStatus,
}: {
  unitId: string
  currentStatus: 'cleaning' | 'available'
}) {
  const [isPending, startTransition] = useTransition()
  const other = currentStatus === 'cleaning' ? 'available' : 'cleaning'

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as 'cleaning' | 'available'
    if (newStatus === currentStatus) return
    startTransition(async () => {
      const result = await updateRoomStatus(unitId, newStatus)
      if (!result.ok) {
        alert(result.error)
        e.target.value = currentStatus
      }
    })
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="px-3 py-1.5 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
    >
      <option value="cleaning">Cleaning</option>
      <option value="available">Available</option>
    </select>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/housekeeping/RoomStatusCard.tsx components/housekeeping/RoomStatusDropdown.tsx
git commit -m "feat(components): RoomStatusCard + RoomStatusDropdown (cleaning/available only)"
```

---

## Task 9: MaintenanceReportModal

**Files:**
- Create: `components/housekeeping/MaintenanceReportModal.tsx` (client)

**Interfaces:**
- Consumes: types `MaintenanceIssueType`, `MaintenanceSeverity`; server action `reportMaintenance`; list of `RoomUnitBasic` for dropdown
- Produces: `<MaintenanceReportModal roomUnits={...}>` — opens form, submits via server action

- [ ] **Step 1: Create MaintenanceReportModal.tsx (Client)**

Write `components/housekeeping/MaintenanceReportModal.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { reportMaintenance } from '@/app/actions/housekeeping'
import type { RoomUnitBasic, MaintenanceIssueType, MaintenanceSeverity } from '@/lib/data/types'

const ISSUE_TYPES: { value: MaintenanceIssueType; label: string }[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC / AC' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'other', label: 'Other' },
]

const SEVERITIES: { value: MaintenanceSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical (room flagged)' },
]

export function MaintenanceReportModal({ roomUnits }: { roomUnits: RoomUnitBasic[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await reportMaintenance({
        room_unit_id: form.get('room_unit_id') as string,
        issue_type: form.get('issue_type') as MaintenanceIssueType,
        severity: form.get('severity') as MaintenanceSeverity,
        title: form.get('title') as string,
        description: (form.get('description') as string) || undefined,
      })
      if (result.ok) {
        setIsOpen(false)
        e.currentTarget?.reset()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-secondary rounded-md font-label-md text-label-md hover:bg-primary-container transition-colors"
      >
        <MaterialIcon name="build" size={18} />
        New Report
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-level-2 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-headline-sm text-primary">Report Maintenance Issue</h2>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-surface-container">
                <MaterialIcon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">Room</label>
                <select name="room_unit_id" required className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  <option value="">Select room...</option>
                  {roomUnits.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.floor}·{u.unit_label} — {u.room_type?.name ?? 'Room'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">Issue Type</label>
                <select name="issue_type" required className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">Severity</label>
                <select name="severity" required defaultValue="medium" className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
                  {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">Title</label>
                <input name="title" required maxLength={100} className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Short summary" />
              </div>
              <div>
                <label className="block text-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-1.5">Description (optional)</label>
                <textarea name="description" rows={3} className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-container-low text-body-md focus:outline-none focus:ring-2 focus:ring-secondary" />
              </div>
              {error && <p className="text-body-md text-error">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 px-4 py-2 border border-outline-variant rounded-md text-body-md text-primary hover:bg-surface-container">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-primary text-secondary rounded-md font-label-md text-label-md hover:bg-primary-container disabled:opacity-50">
                  {isPending ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/housekeeping/MaintenanceReportModal.tsx
git commit -m "feat(components): MaintenanceReportModal with severity-based room auto-flag"
```

---

## Task 10: Visualization Components

**Files:**
- Create: `components/housekeeping/ShiftProgress.tsx` (server)
- Create: `components/housekeeping/DailyPerformanceChart.tsx` (server, SVG)

**Interfaces:**
- Consumes: types `WorkHistoryData` parts
- Produces: `<ShiftProgress percent={...} />`, `<DailyPerformanceChart data={[{date,count}]} />`

- [ ] **Step 1: Create ShiftProgress.tsx**

Write `components/housekeeping/ShiftProgress.tsx`:

```tsx
export function ShiftProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="font-display-lg text-display-lg text-primary">{clamped}%</span>
        <span className="text-caption text-on-surface-variant uppercase tracking-wider">Target: 12 rooms</span>
      </div>
      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className="h-full bg-secondary transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DailyPerformanceChart.tsx**

Write `components/housekeeping/DailyPerformanceChart.tsx`:

```tsx
import type { WorkHistoryData } from '@/lib/data/types'

export function DailyPerformanceChart({ data }: { data: WorkHistoryData['dailyPerformance'] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const barWidth = 100 / data.length

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-40 mb-2">
        {data.map((d, i) => {
          const heightPct = (d.count / max) * 100
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="relative w-full h-full flex items-end">
                <div
                  className="w-full bg-secondary rounded-t-md transition-all duration-500"
                  style={{ height: `${heightPct}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                  title={`${d.date}: ${d.count} tasks`}
                />
              </div>
              <span className="text-caption text-on-surface-variant mt-1.5">{d.date}</span>
              <span className="text-caption font-semibold text-primary">{d.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/housekeeping/ShiftProgress.tsx components/housekeeping/DailyPerformanceChart.tsx
git commit -m "feat(components): ShiftProgress + DailyPerformanceChart (no chart lib)"
```

---

## Task 11: Housekeeper Layout + Dashboard Page

**Files:**
- Create: `app/housekeeper/layout.tsx` (server)
- Create: `app/housekeeper/page.tsx` (server, dashboard)

**Interfaces:**
- Consumes: `StaffSidebar`, `getSession`, `getMyDashboardStats`, `getAllRoomUnits`
- Produces: `/housekeeper` route with sidebar + dashboard

- [ ] **Step 1: Create layout.tsx**

Write `app/housekeeper/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession } from '@/lib/supabase/getSession'
import { StaffSidebar } from '@/components/layout/StaffSidebar'

export const dynamic = 'force-dynamic'

export default async function HousekeeperLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?next=/housekeeper')
  if (session.role !== 'housekeeper' && session.role !== 'admin') redirect('/')

  const headerList = await headers()
  const pathname = headerList.get('x-invoke-path') ?? '/housekeeper'

  return (
    <div className="min-h-screen flex">
      <StaffSidebar role="housekeeper" userName={session.fullName} pathname={pathname} />
      <main className="flex-1 bg-background min-h-screen overflow-x-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create dashboard page.tsx**

Write `app/housekeeper/page.tsx`:

```tsx
import { getSession } from '@/lib/supabase/getSession'
import { getMyDashboardStatsForUser, getAllRoomUnits } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'
import { ShiftProgress } from '@/components/housekeeping/ShiftProgress'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

export default async function HousekeeperDashboard() {
  const session = await getSession()
  const stats = await getMyDashboardStatsForUser(session!.userId)
  const roomUnits = await getAllRoomUnits()
  const name = session!.fullName ?? 'Housekeeper'

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {greeting()}, {name}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">Here's your shift overview.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Rooms to Clean</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.roomsToClean}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Shift Progress</p>
          <ShiftProgress percent={stats.shiftProgress} />
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">My Tasks</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.myTasksCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Open Maintenance</p>
          <p className="font-display-lg text-display-lg text-primary">{stats.maintenanceOpenCount}</p>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <MaterialIcon name="priority_high" size={24} className="text-error" />
            Priority Tasks
          </h2>
        </div>
        {stats.priorityTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No priority tasks right now.</p>
        ) : (
          <div className="space-y-3">
            {stats.priorityTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <MaterialIcon name="task_alt" size={24} />
          My Active Tasks
        </h2>
        {stats.activeTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No active tasks. Check the unassigned pool.</p>
        ) : (
          <div className="space-y-3">
            {stats.activeTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section className="flex justify-end">
        <MaintenanceReportModal roomUnits={roomUnits} />
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Verify build works**

Run: `npm run build 2>&1 | tail -30`
Expected: No errors related to `/housekeeper` route

- [ ] **Step 4: Manual verify in browser**

Start dev server: `npm run dev`
Login as `somjit@zenzero.com` / `Housekeep123!`
Visit: `http://localhost:3000/housekeeper`
Expected: Dashboard shows greeting, 4 stat cards, priority tasks list (mock data populated)

- [ ] **Step 5: Commit**

```bash
git add app/housekeeper/layout.tsx app/housekeeper/page.tsx
git commit -m "feat(housekeeper): layout + dashboard page"
```

---

## Task 12: Room Status Overview Page

**Files:**
- Create: `app/housekeeper/rooms/page.tsx` (server)

**Interfaces:**
- Consumes: `getAllRoomUnits`, `RoomStatusCard`
- Produces: `/housekeeper/rooms` route

- [ ] **Step 1: Create rooms page.tsx**

Write `app/housekeeper/rooms/page.tsx`:

```tsx
import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { RoomStatusCard } from '@/components/housekeeping/RoomStatusCard'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS = ['all', 'available', 'occupied', 'cleaning', 'maintenance', 'out_of_order'] as const

export default async function RoomStatusOverview({ searchParams }: PageProps<'/housekeeper/rooms'>) {
  const params = await searchParams
  const filter = (params.status as typeof STATUS_FILTERS[number]) || 'all'
  const units = await getAllRoomUnits()
  const filtered = filter === 'all' ? units : units.filter(u => u.status === filter)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">Room Status Overview</h1>
        <p className="text-body-lg text-on-surface-variant">All physical rooms and their current status.</p>
      </header>

      <nav className="flex gap-2 mb-8 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/housekeeper/rooms' : `/housekeeper/rooms?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-label-md text-label-md uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {f.replace('_', ' ')}
          </a>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">No rooms match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => <RoomStatusCard key={u.id} unit={u} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "error|housekeeper/rooms" | head -10`
Expected: No errors for `/housekeeper/rooms`

- [ ] **Step 3: Manual verify**

Visit: `http://localhost:3000/housekeeper/rooms`
Expected: 12 room cards. Click filter chip — URL updates, grid filters. For rooms with status='cleaning' or 'available', dropdown shows. Toggle dropdown → page refreshes, status changes.

- [ ] **Step 4: Commit**

```bash
git add app/housekeeper/rooms/page.tsx
git commit -m "feat(housekeeper): room status overview page with cleaning/available toggle"
```

---

## Task 13: My Tasks Page

**Files:**
- Create: `app/housekeeper/tasks/page.tsx` (server)
- Create: `components/housekeeping/TaskActions.tsx` (client — combined claim/start/complete actions)

**Interfaces:**
- Consumes: `getMyTasksForUser`, `getUnassignedTasks`, `TaskCard`
- Produces: `/housekeeper/tasks` route with two sections (My Tasks + Unassigned Pool)

- [ ] **Step 1: Create TaskActions.tsx (Client)**

Write `components/housekeeping/TaskActions.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { startTask, completeTask } from '@/app/actions/housekeeping'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { HousekeepingTaskStatus } from '@/lib/data/types'

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string
  status: HousekeepingTaskStatus
}) {
  const [isPending, startTransition] = useTransition()

  if (status !== 'assigned' && status !== 'in_progress') return null

  function handle(action: 'start' | 'complete') {
    if (action === 'start' && !confirm('Start this task? Room status will change to cleaning.')) return
    if (action === 'complete' && !confirm('Mark as completed? This will mark the room available.')) return
    startTransition(async () => {
      const fn = action === 'start' ? startTask : completeTask
      const result = await fn(taskId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <div className="flex gap-2">
      {status === 'assigned' && (
        <button
          onClick={() => handle('start')}
          disabled={isPending}
          className="px-3 py-1.5 bg-primary text-secondary rounded-md text-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <MaterialIcon name="play_arrow" size={16} />
          Start
        </button>
      )}
      {status === 'in_progress' && (
        <button
          onClick={() => handle('complete')}
          disabled={isPending}
          className="px-3 py-1.5 bg-secondary text-primary rounded-md text-label-md text-label-md hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <MaterialIcon name="check" size={16} />
          Complete
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update TaskCard.tsx to render TaskActions**

Edit `components/housekeeping/TaskCard.tsx` — change the variant === 'unassigned' check to also handle 'my' variant. Find:

```tsx
      {variant === 'unassigned' && (
        <TaskClaimButton taskId={task.id} />
      )}
```

Replace with:

```tsx
      {variant === 'unassigned' && <TaskClaimButton taskId={task.id} />}
      {variant === 'my' && <TaskActions taskId={task.id} status={task.status} />}
```

Then add import at top:

```tsx
import { TaskActions } from './TaskActions'
```

- [ ] **Step 3: Create tasks page.tsx**

Write `app/housekeeper/tasks/page.tsx`:

```tsx
import { getSession } from '@/lib/supabase/getSession'
import { getMyTasksForUser, getUnassignedTasks } from '@/lib/data/housekeeper'
import { TaskCard } from '@/components/housekeeping/TaskCard'

export const dynamic = 'force-dynamic'

export default async function MyTasksPage() {
  const session = await getSession()
  const [myTasks, unassigned] = await Promise.all([
    getMyTasksForUser(session!.userId),
    getUnassignedTasks(),
  ])

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">My Tasks</h1>
        <p className="text-body-lg text-on-surface-variant">Tasks assigned to you and the unassigned pool.</p>
      </header>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          My Tasks ({myTasks.length})
        </h2>
        {myTasks.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No tasks assigned to you. Claim from the pool below.</p>
        ) : (
          <div className="space-y-3">
            {myTasks.map(t => <TaskCard key={t.id} task={t} variant="my" />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          Unassigned Pool ({unassigned.length})
        </h2>
        {unassigned.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No tasks in the unassigned pool. Great work!</p>
        ) : (
          <div className="space-y-3">
            {unassigned.map(t => <TaskCard key={t.id} task={t} variant="unassigned" />)}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | grep -E "error|housekeeper/tasks" | head -10`
Expected: No errors

- [ ] **Step 5: Manual verify**

Visit: `http://localhost:3000/housekeeper/tasks`
Expected: Two sections. "My Tasks" shows assigned. "Unassigned Pool" shows 2-3 unassigned. Click Claim — moves to My Tasks. Click Start — status changes. Click Complete — task disappears from My Tasks.

- [ ] **Step 6: Commit**

```bash
git add components/housekeeping/TaskActions.tsx components/housekeeping/TaskCard.tsx app/housekeeper/tasks/page.tsx
git commit -m "feat(housekeeper): my tasks page with claim/start/complete actions"
```

---

## Task 14: Maintenance Reports Page

**Files:**
- Create: `app/housekeeper/maintenance/page.tsx` (server)
- Create: `components/housekeeping/MaintenanceReportCard.tsx` (server)

**Interfaces:**
- Consumes: `getMaintenanceReports`, `MaintenanceReportModal`, `getAllRoomUnits`
- Produces: `/housekeeper/maintenance` route with filterable list + new report button

- [ ] **Step 1: Create MaintenanceReportCard.tsx**

Write `components/housekeeping/MaintenanceReportCard.tsx`:

```tsx
import { SeverityBadge } from './SeverityBadge'
import { StatusBadge } from './StatusBadge'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { MaintenanceReport } from '@/lib/data/types'

const ISSUE_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC / AC',
  furniture: 'Furniture',
  appliance: 'Appliance',
  other: 'Other',
}

export function MaintenanceReportCard({ report }: { report: MaintenanceReport }) {
  const unit = report.room_unit
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant/30">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-headline-sm text-headline-sm text-primary">{report.title}</h4>
        <SeverityBadge severity={report.severity} />
      </div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
          {ISSUE_LABELS[report.issue_type] ?? report.issue_type}
        </span>
        <StatusBadge status={report.status} />
        {unit && (
          <span className="text-caption text-on-surface-variant">
            Room {unit.unit_label}
          </span>
        )}
      </div>
      {report.description && (
        <p className="text-body-md text-on-surface-variant mb-3">{report.description}</p>
      )}
      <div className="flex items-center gap-3 text-caption text-on-surface-variant pt-3 border-t border-outline-variant/30">
        <span className="flex items-center gap-1">
          <MaterialIcon name="person" size={14} />
          {report.reporter?.full_name ?? 'Unknown'}
        </span>
        <span className="flex items-center gap-1">
          <MaterialIcon name="schedule" size={14} />
          {new Date(report.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create maintenance page.tsx**

Write `app/housekeeper/maintenance/page.tsx`:

```tsx
import { getMaintenanceReports, getAllRoomUnits } from '@/lib/data/housekeeper'
import { MaintenanceReportCard } from '@/components/housekeeping/MaintenanceReportCard'
import { MaintenanceReportModal } from '@/components/housekeeping/MaintenanceReportModal'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved'] as const

export default async function MaintenanceReportsPage({ searchParams }: PageProps<'/housekeeper/maintenance'>) {
  const params = await searchParams
  const filter = (params.status as typeof STATUS_FILTERS[number]) || 'all'
  const reports = await getMaintenanceReports(filter === 'all' ? undefined : { status: [filter] })
  const roomUnits = await getAllRoomUnits()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">Maintenance & Damage Reports</h1>
          <p className="text-body-lg text-on-surface-variant">Track reported issues across the hotel.</p>
        </div>
        <MaintenanceReportModal roomUnits={roomUnits} />
      </header>

      <nav className="flex gap-2 mb-8 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <a
            key={f}
            href={f === 'all' ? '/housekeeper/maintenance' : `/housekeeper/maintenance?status=${f}`}
            className={`px-4 py-1.5 rounded-full text-label-md text-label-md uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-primary text-secondary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {f.replace('_', ' ')}
          </a>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant italic">No reports match this filter.</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => <MaintenanceReportCard key={r.id} report={r} />)}
        </div>
      )}

      <p className="mt-8 text-caption text-on-surface-variant italic">
        Note: Resolving reports requires manager role (coming soon).
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -E "error|housekeeper/maintenance" | head -10`
Expected: No errors

- [ ] **Step 4: Manual verify**

Visit: `http://localhost:3000/housekeeper/maintenance`
Expected: List of 5 mock reports. Filter by status works. Click "New Report" — modal opens, fill form, submit — new row appears. Submit with severity=critical → room_units.status='maintenance' for that unit.

- [ ] **Step 5: Commit**

```bash
git add components/housekeeping/MaintenanceReportCard.tsx app/housekeeper/maintenance/page.tsx
git commit -m "feat(housekeeper): maintenance reports page with new report modal"
```

---

## Task 15: Work History Page

**Files:**
- Create: `app/housekeeper/history/page.tsx` (server)

**Interfaces:**
- Consumes: `getMyWorkHistoryForUser`, `getAllWorkHistory`, `DailyPerformanceChart`, `TaskCard`
- Produces: `/housekeeper/history` route with My/All toggle

- [ ] **Step 1: Create history page.tsx**

Write `app/housekeeper/history/page.tsx`:

```tsx
import { getSession } from '@/lib/supabase/getSession'
import { getMyWorkHistoryForUser, getAllWorkHistory } from '@/lib/data/housekeeper'
import { DailyPerformanceChart } from '@/components/housekeeping/DailyPerformanceChart'
import { TaskCard } from '@/components/housekeeping/TaskCard'

export const dynamic = 'force-dynamic'

export default async function WorkHistoryPage({ searchParams }: PageProps<'/housekeeper/history'>) {
  const params = await searchParams
  const scope = params.scope === 'all' ? 'all' : 'me'
  const session = await getSession()
  const data = scope === 'all'
    ? await getAllWorkHistory()
    : await getMyWorkHistoryForUser(session!.userId)

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">Work History Analytics</h1>
        <p className="text-body-lg text-on-surface-variant">Track your shift performance over time.</p>
      </header>

      <nav className="flex gap-2 mb-8">
        <a
          href="/housekeeper/history"
          className={`px-4 py-1.5 rounded-full text-label-md text-label-md uppercase tracking-wider transition-colors ${
            scope === 'me' ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          My History
        </a>
        <a
          href="/housekeeper/history?scope=all"
          className={`px-4 py-1.5 rounded-full text-label-md text-label-md uppercase tracking-wider transition-colors ${
            scope === 'all' ? 'bg-primary text-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All Hotel
        </a>
      </nav>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Rooms Cleaned</p>
          <p className="font-display-lg text-display-lg text-primary">{data.roomsCleaned}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Avg Time</p>
          <p className="font-display-lg text-display-lg text-primary">
            {data.avgMinutes !== null ? `${data.avgMinutes}m` : '—'}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Today</p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksToday}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">This Week</p>
          <p className="font-display-lg text-display-lg text-primary">{data.tasksThisWeek}</p>
        </div>
      </section>

      <section className="mb-12 bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">Daily Cleaning Performance</h2>
        <DailyPerformanceChart data={data.dailyPerformance} />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">Recent Task Log</h2>
        {data.recentLog.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">No completed tasks yet.</p>
        ) : (
          <div className="space-y-3">
            {data.recentLog.map(t => <TaskCard key={t.id} task={t} variant="history" />)}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "error|housekeeper/history" | head -10`
Expected: No errors

- [ ] **Step 3: Manual verify**

Visit: `http://localhost:3000/housekeeper/history`
Expected: 4 stat cards populated. Bar chart renders. Task log table. Toggle "All Hotel" → numbers change (more rooms cleaned).

- [ ] **Step 4: Commit**

```bash
git add app/housekeeper/history/page.tsx
git commit -m "feat(housekeeper): work history page with my/all toggle + performance chart"
```

---

## Task 16: Test User + Documentation Updates

**Files:**
- Modify: `CLAUDE.md` — add test user, mark Phase 5 complete
- Modify: `README.md` — add Housekeeper to features

- [ ] **Step 1: Update CLAUDE.md**

Edit `Y:\Final\final\CLAUDE.md`. Find the "Test Users" section and add:

```markdown
- `somjit@zenzero.com` / `Housekeep123!` — housekeeper
```

Also in "Current Status" section, update:

```markdown
**Built**: 2 roles (User + Reception) — 17 routes
```

Replace with:

```markdown
**Built**: 3 roles (User + Reception + Housekeeper) — 22 routes
```

And update "Planned but not built" line:

```markdown
**Planned but not built**: Housekeeper role (5 pages)
```

Replace with:

```markdown
**Planned but not built**: Manager role (maintenance resolve flow)
```

- [ ] **Step 2: Update README.md**

Edit `Y:\Final\final\README.md`. Find "### Housekeeper" section:

```markdown
### Housekeeper
- (Coming soon)
```

Replace with:

```markdown
### Housekeeper
- Dashboard with shift progress
- Room status overview (toggle cleaning/available)
- My tasks (claim, start, complete)
- Maintenance & damage reports
- Work history analytics
```

Also update the test users table to add `somjit@zenzero.com` row.

- [ ] **Step 3: Update priority list in CLAUDE.md**

In CLAUDE.md "What to do next" section, find Phase 5:

```markdown
1. Phase 5: Housekeeper (5 pages) — optional
```

Replace with:

```markdown
1. ~~Phase 5: Housekeeper (5 pages)~~ ✅ Done
2. Manager role + maintenance resolve flow (next)
```

- [ ] **Step 4: Final verification**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: All pass

- [ ] **Step 5: Commit docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs: mark Phase 5 complete, add housekeeper test user, update features"
```

---

## Task 17: Final Manual Test Pass

**Files:** (no code changes)

- [ ] **Step 1: Run automated checks**

Run:
```bash
npm run typecheck
npm run lint
npm run build
```
Expected: All pass with 0 errors

- [ ] **Step 2: Mock-mode E2E test**

Set `USE_MOCK_DATA=1` in `.env.local`
Login as `somjit@zenzero.com` / `Housekeep123!`
Test all 5 pages:
- `/housekeeper` — dashboard renders 4 stats, priority tasks, active tasks
- `/housekeeper/rooms` — 12 rooms, filter works, dropdown toggles cleaning ↔ available
- `/housekeeper/tasks` — My Tasks + Unassigned Pool sections, Claim button works
- `/housekeeper/maintenance` — list, New Report modal, submit
- `/housekeeper/history` — toggle My/All, chart renders, recent log

- [ ] **Step 3: Real-mode E2E test**

Set `USE_MOCK_DATA=0` in `.env.local`
Repeat all tests with real Supabase data

- [ ] **Step 4: RLS access test**

- Login as `somchai@example.com` (user role) → try `/housekeeper` → should redirect to `/`
- Login as `test@zenzero.com` (reception role) → try `/housekeeper` → should redirect to `/`
- Login as `somjit@zenzero.com` (housekeeper role) → try `/reception` → should redirect to `/`

- [ ] **Step 5: Trigger test**

In real-mode Supabase SQL Editor:
```sql
-- Pick an unassigned task and a housekeeper
update housekeeping_tasks set status = 'assigned', assigned_to = (select id from profiles where role='housekeeper' limit 1) where id = (select id from housekeeping_tasks where status='unassigned' limit 1);
update housekeeping_tasks set status = 'in_progress' where assigned_to is not null limit 1;
select id, status, room_unit_id, started_at from housekeeping_tasks where status='in_progress';
select id, status from room_units where id = (select room_unit_id from housekeeping_tasks where status='in_progress' limit 1);
```
Expected: room_units.status='cleaning'

Then:
```sql
update housekeeping_tasks set status = 'completed' where status='in_progress' limit 1;
select id, status from room_units where status='available' limit 5;
```
Expected: the task's room_unit is now status='available'

- [ ] **Step 6: Critical maintenance trigger test**

```sql
insert into maintenance_reports (room_unit_id, issue_type, severity, title, reported_by)
values ((select id from room_units limit 1), 'plumbing', 'critical', 'Test critical', (select id from profiles where role='housekeeper' limit 1));
select id, status from room_units where id = (select room_unit_id from maintenance_reports where severity='critical' order by created_at desc limit 1);
```
Expected: room_units.status='maintenance'

- [ ] **Step 7: Final commit if any tweaks**

```bash
git status
# if any code changes:
git add -A
git commit -m "fix: post-test adjustments"
```

---

## Self-Review

**1. Spec coverage** — each requirement maps to a task:
- 5 pages → Tasks 11-15
- 2 new tables + RLS + triggers → Tasks 1-2
- Server actions (5) → Task 5
- Data layer (mock + real toggle) → Tasks 3-4
- StaffSidebar already exists (HOUSEKEEPER_NAV) → no task needed
- Test user somjit@zenzero.com → Task 2 (Step 4) + Task 16
- Design system tokens → referenced in Global Constraints
- Mock JSON file → Task 3
- Trigger keeping room_units.status in sync → Task 1 (trg_task_status)
- Critical maintenance auto-flags room → Task 1 (trg_maint_insert)
- Per-helper My/All toggle in Work History → Task 15
- Housekeeper self-assign from unassigned pool → Tasks 7 (TaskClaimButton) + 13 (My Tasks page)

**2. Placeholder scan** — no TBD/TODO/"implement later"/"fill in details" in any task

**3. Type consistency**:
- `HousekeepingTask`, `HousekeepingTaskStatus`, `HousekeepingTaskPriority` defined in Task 3, used in Tasks 4, 5, 6, 7, 13
- `MaintenanceReport`, `MaintenanceIssueType`, `MaintenanceSeverity`, `MaintenanceStatus` defined in Task 3, used in Tasks 4, 5, 6, 9, 14
- `DashboardStats`, `WorkHistoryData` defined in Task 3, used in Tasks 4, 10, 11, 15
- `RoomUnitBasic` defined in Task 3, used in Tasks 4, 8, 9, 12, 14
- Server actions return `ActionResult` defined in Task 5
- Function names: `getMyTasksForUser`, `getUnassignedTasks`, `getMaintenanceReports`, `getMyDashboardStatsForUser`, `getAllRoomUnits`, `getMyWorkHistoryForUser`, `getAllWorkHistory` defined in Task 4 — used in pages consistently

**4. Scope**: 17 tasks, ~80% frontend, focused on Phase 5 spec