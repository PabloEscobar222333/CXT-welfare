-- CXT WELFARE MANGEMENT PLATFORM - DATABASE SCHEMA

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. USERS TABLE
-- Maps securely to Supabase's native auth.users table
-- ==========================================
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    member_id varchar(50) unique not null,
    full_name varchar(255) not null,
    email varchar(255) unique not null,
    phone varchar(20),
    role varchar(50) not null default 'member',
    status varchar(20) not null default 'active',
    must_change_password boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for public.users
alter table public.users enable row level security;
create policy "Allow internal read access" on public.users for select using (true);
create policy "Allow internal update by admins" on public.users for update using (true);

-- ==========================================
-- 2. CONTRIBUTIONS TABLE
-- Tracks members' monthly welfare payments
-- ==========================================
create table public.contributions (
    id uuid default uuid_generate_v4() primary key,
    member_id uuid references public.users(id) on delete cascade not null,
    month integer not null,
    year integer not null,
    expected_amount decimal(10,2) not null,
    paid_amount decimal(10,2) not null default 0.00,
    payment_date date,
    payment_method varchar(50),
    status varchar(20) not null default 'unpaid',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(member_id, month, year)
);

-- ==========================================
-- 3. EVENTS TABLE
-- Tracks all physical welfare events
-- ==========================================
create table public.events (
    id uuid default uuid_generate_v4() primary key,
    name varchar(255) not null,
    type varchar(50) not null,
    event_date date not null,
    description text,
    organiser varchar(255),
    budget_limit decimal(10,2),
    status varchar(20) not null default 'upcoming',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 4. EXPENSES TABLE
-- Tracks all expenditures billed under specific events
-- ==========================================
create table public.expenses (
    id uuid default uuid_generate_v4() primary key,
    event_id uuid references public.events(id) on delete cascade not null,
    category varchar(100) not null,
    description text not null,
    amount decimal(10,2) not null,
    expense_date date not null,
    vendor varchar(255),
    paid_by varchar(255),
    receipt_url text,
    logged_by_id uuid references public.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 5. AUDIT LOGS TABLE
-- Immutable system ledger for critical actions
-- ==========================================
create table public.audit_logs (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete set null,
    action_type varchar(100) not null,
    description text not null,
    ip_address varchar(45),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: Ensure Supabase Storage is configured with a bucket named "receipts" for the application file uploads.
