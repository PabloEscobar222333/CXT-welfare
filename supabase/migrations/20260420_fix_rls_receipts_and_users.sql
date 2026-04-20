-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix_rls_receipts_and_users
-- Purpose  : Fix two RLS-related bugs:
--
--   1. STORAGE – receipts bucket
--      No INSERT / UPDATE policy existed, so every upload attempt by
--      authenticated users (including super_admin & treasurer) was rejected
--      with "new row violates row-level security policy".
--
--   2. USERS TABLE – privileged roles can read all rows
--      The existing SELECT policy only allowed users to read their OWN row.
--      This caused contributionService.getActiveMembers() to return 0 rows
--      for treasurer, secretary, chairman, auditor, and super_admin logins
--      because the query filters on role='member' — never matching the
--      caller's own row.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1.  STORAGE — receipts bucket
--     Allow any authenticated user to INSERT, SELECT, and UPDATE objects
--     inside the "receipts" bucket.
--     (Object-level deletes are not exposed in the UI, so no DELETE policy.)
-- ══════════════════════════════════════════════════════════════════════════════

-- Ensure RLS is enabled on storage.objects (it is by default in Supabase,
-- but we make this idempotent just in case).
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── INSERT (upload) ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload to receipts" ON storage.objects;

CREATE POLICY "Authenticated users can upload to receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- ── SELECT (read / download) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read receipts" ON storage.objects;

CREATE POLICY "Authenticated users can read receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- ── UPDATE (upsert / replace) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;

CREATE POLICY "Authenticated users can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');


-- ══════════════════════════════════════════════════════════════════════════════
-- 2.  USERS TABLE — privileged roles can read ALL rows
--
--     Supabase sets RLS to ON for public tables by default.
--     Without an explicit SELECT policy, the anon/authenticated roles cannot
--     read any rows.  We add two complementary SELECT policies:
--
--       a) Users can always read their OWN row  (needed for auth profile fetch)
--       b) Privileged roles can read ALL rows    (needed for member lists,
--          contributions, expense lookups, etc.)
--
--     PostgreSQL evaluates multiple SELECT policies with OR logic, so both
--     policies co-exist safely.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ── a) Own-row read access (all authenticated users) ─────────────────────────
DROP POLICY IF EXISTS "Users can read own row" ON public.users;

CREATE POLICY "Users can read own row"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ── b) Privileged roles can read every row ────────────────────────────────────
--     Uses a sub-select on users so the role check is always live (no JWT claim
--     tricks that could be spoofed client-side).
DROP POLICY IF EXISTS "Privileged roles can read all users" ON public.users;

CREATE POLICY "Privileged roles can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman', 'auditor')
  )
);

-- ── c) Users can UPDATE their own row (profile / phone / must_change_password) ─
DROP POLICY IF EXISTS "Users can update own row" ON public.users;

CREATE POLICY "Users can update own row"
ON public.users
FOR UPDATE
TO authenticated
USING  (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ── d) Privileged roles can UPDATE any row (status, role changes etc.) ─────────
DROP POLICY IF EXISTS "Privileged roles can update all users" ON public.users;

CREATE POLICY "Privileged roles can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer')
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3.  CONTRIBUTIONS TABLE — all authenticated privileged roles can read/write
--     (Treasurer needs to read & upsert contributions for all members)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Privileged roles can read contributions" ON public.contributions;

CREATE POLICY "Privileged roles can read contributions"
ON public.contributions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'auditor', 'secretary', 'chairman', 'member')
  )
);

-- INSERT / UPSERT
DROP POLICY IF EXISTS "Privileged roles can insert contributions" ON public.contributions;

CREATE POLICY "Privileged roles can insert contributions"
ON public.contributions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Privileged roles can update contributions" ON public.contributions;

CREATE POLICY "Privileged roles can update contributions"
ON public.contributions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4.  EXPENSES TABLE — all authenticated roles can read; write restricted
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- SELECT (all authenticated roles, including member/auditor read-only)
DROP POLICY IF EXISTS "Authenticated users can read expenses" ON public.expenses;

CREATE POLICY "Authenticated users can read expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (true);

-- INSERT
DROP POLICY IF EXISTS "Privileged roles can insert expenses" ON public.expenses;

CREATE POLICY "Privileged roles can insert expenses"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);

-- UPDATE (including receipt_url)
DROP POLICY IF EXISTS "Privileged roles can update expenses" ON public.expenses;

CREATE POLICY "Privileged roles can update expenses"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5.  EVENTS TABLE — privileged roles can read/write
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT (all authenticated)
DROP POLICY IF EXISTS "Authenticated users can read events" ON public.events;

CREATE POLICY "Authenticated users can read events"
ON public.events
FOR SELECT
TO authenticated
USING (true);

-- INSERT
DROP POLICY IF EXISTS "Privileged roles can insert events" ON public.events;

CREATE POLICY "Privileged roles can insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Privileged roles can update events" ON public.events;

CREATE POLICY "Privileged roles can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);

-- DELETE
DROP POLICY IF EXISTS "Privileged roles can delete events" ON public.events;

CREATE POLICY "Privileged roles can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM   public.users u
    WHERE  u.id   = auth.uid()
    AND    u.role IN ('super_admin', 'treasurer', 'secretary', 'chairman')
  )
);
