// Run manager migration with COMMIT hack for ALTER TYPE ADD VALUE.
import pg from 'pg'
import { pgPoolerConfig } from './_db-connection.mjs'

const c = new pg.Client(pgPoolerConfig())

async function run() {
  await c.connect()
  console.log('--- 1) add enum value ---')
  try {
    await c.query(`alter type public.user_role add value 'manager'`)
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('  (already exists, skipping)')
    } else {
      throw e
    }
  }
  // Force-commit: ALTER TYPE ADD VALUE cannot run in same tx as next DDL
  await c.query(`commit`)

  console.log('--- 2) recreate is_staff() ---')
  await c.query(`
    create or replace function public.is_staff()
    returns boolean
    language sql
    security definer
    stable
    set search_path = public
    as $$
      select exists (
        select 1 from public.profiles
        where id = (select auth.uid())
        and role in ('reception', 'housekeeper', 'manager', 'admin')
      );
    $$
  `)

  console.log('--- 3) manager update policies ---')
  await c.query(`
    drop policy if exists "maint manager resolve" on public.maintenance_reports;
    create policy "maint manager resolve"
      on public.maintenance_reports for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
        )
      );
  `)
  console.log('  ✓ maint manager resolve')

  await c.query(`
    drop policy if exists "room_units manager update" on public.room_units;
    create policy "room_units manager update"
      on public.room_units for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role in ('manager', 'admin')
        )
      );
  `)
  console.log('  ✓ room_units manager update')

  console.log('--- 4) verify ---')
  const { rows } = await c.query(
    `select enumlabel from pg_enum where enumtypid = 'public.user_role'::regtype order by enumsortorder`,
  )
  console.log('  enum values now:', rows.map((r) => r.enumlabel).join(', '))

  await c.end()
  console.log('\n✅ Done')
}

run().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
