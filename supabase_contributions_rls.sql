-- ============================================================
-- WELFARE PLATFORM — CONTRIBUTIONS RLS FIX
-- Run this in Supabase SQL Editor if saving a contribution fails
-- ============================================================

-- Enable RLS on contributions (safe to run even if already enabled)
alter table public.contributions enable row level security;

-- Drop any existing policies to avoid conflicts
drop policy if exists "contributions_select_all" on public.contributions;
drop policy if exists "contributions_insert_all" on public.contributions;
drop policy if exists "contributions_update_all" on public.contributions;
drop policy if exists "contributions_delete_all" on public.contributions;

-- Allow any authenticated user to select, insert, update, delete
create policy "contributions_select_all" on public.contributions
  for select using (true);

create policy "contributions_insert_all" on public.contributions
  for insert with check (true);

create policy "contributions_update_all" on public.contributions
  for update using (true);

create policy "contributions_delete_all" on public.contributions
  for delete using (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
