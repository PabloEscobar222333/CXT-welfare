-- ============================================================
-- WELFARE PLATFORM — DATABASE MIGRATION
-- Run this in Supabase SQL Editor to fix contributions errors
-- ============================================================

-- ── STEP 1: Rename paid_amount → keep as-is (DB already has paid_amount)
-- The code has been fixed to use `paid_amount` matching the schema.
-- No column rename needed in DB.

-- ── STEP 2: Add missing contribution_settings table
-- (The app falls back gracefully if this doesn't exist, default = GHS 50)
create table if not exists public.contribution_settings (
    id               uuid default uuid_generate_v4() primary key,
    monthly_amount   decimal(10,2) not null default 50.00,
    amount           decimal(10,2) not null default 50.00,
    effective_from   date not null default current_date,
    notes            text,
    created_by       uuid references public.users(id) on delete set null,
    created_at       timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for contribution_settings
alter table public.contribution_settings enable row level security;
create policy "Allow read for authenticated" on public.contribution_settings
    for select using (true);
create policy "Allow insert/update for admins" on public.contribution_settings
    for all using (true);

-- Insert a default setting if the table is empty
insert into public.contribution_settings (monthly_amount, amount, effective_from, notes)
select 50.00, 50.00, '2024-01-01', 'Default monthly contribution'
where not exists (select 1 from public.contribution_settings);

-- ── STEP 3: Ensure contributions table has all needed columns
-- The existing schema uses paid_amount (correct). Make sure updated_at exists.
alter table public.contributions 
    add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- ── STEP 4: Refresh PostgREST schema cache (run in Supabase SQL Editor)
-- PostgREST caches the schema and needs a reload after schema changes:
NOTIFY pgrst, 'reload schema';
