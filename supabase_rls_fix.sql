-- ============================================================
-- WELFARE PLATFORM — EXPENSES & RECEIPTS FIX MIGRATION
-- Run this in Supabase SQL Editor if expense logging fails
-- ============================================================

-- ── FIX 1: Make sure RLS is enabled on expenses and events tables
-- (These were missing from the original schema migration)
alter table public.expenses enable row level security;
alter table public.events   enable row level security;
alter table public.audit_logs enable row level security;

-- ── FIX 2: Add permissive RLS policies for authenticated users
-- Without these, ALL inserts/selects are blocked when RLS is enabled

-- EXPENSES
drop policy if exists "expenses_select_all" on public.expenses;
drop policy if exists "expenses_insert_all" on public.expenses;
drop policy if exists "expenses_update_all" on public.expenses;
drop policy if exists "expenses_delete_all" on public.expenses;

create policy "expenses_select_all" on public.expenses
  for select using (true);
create policy "expenses_insert_all" on public.expenses
  for insert with check (true);
create policy "expenses_update_all" on public.expenses
  for update using (true);
create policy "expenses_delete_all" on public.expenses
  for delete using (true);

-- EVENTS
drop policy if exists "events_select_all" on public.events;
drop policy if exists "events_insert_all" on public.events;
drop policy if exists "events_update_all" on public.events;
drop policy if exists "events_delete_all" on public.events;

create policy "events_select_all" on public.events
  for select using (true);
create policy "events_insert_all" on public.events
  for insert with check (true);
create policy "events_update_all" on public.events
  for update using (true);
create policy "events_delete_all" on public.events
  for delete using (true);

-- AUDIT LOGS
drop policy if exists "audit_logs_select_all"  on public.audit_logs;
drop policy if exists "audit_logs_insert_all"  on public.audit_logs;

create policy "audit_logs_select_all" on public.audit_logs
  for select using (true);
create policy "audit_logs_insert_all" on public.audit_logs
  for insert with check (true);

-- CONTRIBUTIONS (in case they are also blocked)
alter table public.contributions enable row level security;

drop policy if exists "contributions_select_all" on public.contributions;
drop policy if exists "contributions_insert_all" on public.contributions;
drop policy if exists "contributions_update_all" on public.contributions;

create policy "contributions_select_all" on public.contributions
  for select using (true);
create policy "contributions_insert_all" on public.contributions
  for insert with check (true);
create policy "contributions_update_all" on public.contributions
  for update using (true);

-- ── FIX 3: Storage bucket policy for receipts
-- Run this if uploads fail with "access denied" errors
-- In Supabase Dashboard → Storage → receipts bucket → Policies, add:
--   SELECT: true (public read)
--   INSERT: authenticated users
-- OR: make the bucket public in the dashboard (Settings → Public)

-- ── FIX 4: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
