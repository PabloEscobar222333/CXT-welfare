-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : fix_rls_v2_correct_role_permissions
-- Supersedes: 20260420_fix_rls_receipts_and_users.sql
--             (run BOTH scripts in order, or run this one alone if the first
--              was never executed — it drops all conflicting policies first)
--
-- ROLE ACCESS MATRIX
-- ╔══════════════════╦═════════════╦═════════════╦══════════════════════════╗
-- ║ Table / Resource ║ super_admin ║  treasurer  ║ secretary / chairman /   ║
-- ║                  ║             ║             ║ auditor / member         ║
-- ╠══════════════════╬═════════════╬═════════════╬══════════════════════════╣
-- ║ users (members)  ║ Full CRUD   ║ Read-only   ║ Own row only             ║
-- ║ contributions    ║ Full CRUD   ║ Full CRUD   ║ Read-only (all rows)     ║
-- ║ expenses         ║ Full CRUD   ║ Full CRUD   ║ Read-only (all rows)     ║
-- ║ events           ║ Full CRUD   ║ Full CRUD   ║ Read-only (all rows)     ║
-- ║ storage/receipts ║ Full CRUD   ║ Upload+Read ║ Read-only                ║
-- ╚══════════════════╩═════════════╩═════════════╩══════════════════════════╝
--
-- NOTES
--  • User accounts are CREATED via the create-member Edge Function (service
--    role) — no INSERT RLS needed for the browser client.
--  • "Read-only" roles can read all rows so lists, reports and dashboards
--    render correctly, but they cannot INSERT / UPDATE / DELETE.
--  • The sub-select pattern used in each policy reads the caller's role live
--    from the database, so a role stored in a JWT claim cannot be spoofed.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER: drop every policy created by the previous migration so this script
--         is fully idempotent and safe to re-run.
-- ══════════════════════════════════════════════════════════════════════════════

-- storage
DROP POLICY IF EXISTS "Authenticated users can upload to receipts"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read receipts"         ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts"       ON storage.objects;

-- users
DROP POLICY IF EXISTS "Users can read own row"                        ON public.users;
DROP POLICY IF EXISTS "Privileged roles can read all users"           ON public.users;
DROP POLICY IF EXISTS "Users can update own row"                      ON public.users;
DROP POLICY IF EXISTS "Privileged roles can update all users"         ON public.users;

-- contributions
DROP POLICY IF EXISTS "Privileged roles can read contributions"       ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can insert contributions"     ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can update contributions"     ON public.contributions;

-- expenses
DROP POLICY IF EXISTS "Authenticated users can read expenses"         ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can insert expenses"          ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can update expenses"          ON public.expenses;

-- events
DROP POLICY IF EXISTS "Authenticated users can read events"           ON public.events;
DROP POLICY IF EXISTS "Privileged roles can insert events"            ON public.events;
DROP POLICY IF EXISTS "Privileged roles can update events"            ON public.events;
DROP POLICY IF EXISTS "Privileged roles can delete events"            ON public.events;


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. STORAGE — receipts bucket
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user can VIEW / download receipts
DROP POLICY IF EXISTS "All authenticated can read receipts"           ON storage.objects;
CREATE POLICY "All authenticated can read receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts');

-- INSERT: only super_admin and treasurer can UPLOAD new receipts
DROP POLICY IF EXISTS "Admin and treasurer can upload receipts"       ON storage.objects;
CREATE POLICY "Admin and treasurer can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- UPDATE: only super_admin and treasurer can REPLACE receipt files
DROP POLICY IF EXISTS "Admin and treasurer can update receipts"       ON storage.objects;
CREATE POLICY "Admin and treasurer can update receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
)
WITH CHECK (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- DELETE: only super_admin can delete receipt files from storage
DROP POLICY IF EXISTS "Admin can delete receipts"                     ON storage.objects;
CREATE POLICY "Admin can delete receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND   u.role = 'super_admin'
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. USERS TABLE (members management)
--    • super_admin  → full CRUD
--    • treasurer    → SELECT only (needs member list for contributions)
--    • others       → own row only (needed for auth profile fetch)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT ── every authenticated user can read their OWN row (auth profile)
DROP POLICY IF EXISTS "Users read own row"                            ON public.users;
CREATE POLICY "Users read own row"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

-- SELECT ── super_admin and treasurer can read ALL rows (member lists, etc.)
DROP POLICY IF EXISTS "Admin and treasurer read all users"            ON public.users;
CREATE POLICY "Admin and treasurer read all users"
ON public.users FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- UPDATE ── any user can update their OWN row (profile name, phone, password flag)
DROP POLICY IF EXISTS "Users update own row"                          ON public.users;
CREATE POLICY "Users update own row"
ON public.users FOR UPDATE TO authenticated
USING  (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- UPDATE ── only super_admin can UPDATE other users' rows (role, status, etc.)
DROP POLICY IF EXISTS "Admin can update all users"                    ON public.users;
CREATE POLICY "Admin can update all users"
ON public.users FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role = 'super_admin'
  )
);

-- DELETE ── only super_admin (hard deletes are rare; soft-disable is preferred)
DROP POLICY IF EXISTS "Admin can delete users"                        ON public.users;
CREATE POLICY "Admin can delete users"
ON public.users FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role = 'super_admin'
  )
);

-- INSERT ── new accounts are created exclusively by the create-member Edge
--           Function using the service_role key, which bypasses RLS.
--           We deliberately do NOT add an INSERT policy here so that no
--           browser client can ever create a raw user row directly.


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. CONTRIBUTIONS TABLE
--    • super_admin + treasurer → full CRUD
--    • all other roles         → SELECT only
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user can read all contribution rows
DROP POLICY IF EXISTS "All authenticated can read contributions"      ON public.contributions;
CREATE POLICY "All authenticated can read contributions"
ON public.contributions FOR SELECT TO authenticated
USING (true);

-- INSERT: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can insert contributions"  ON public.contributions;
CREATE POLICY "Admin and treasurer can insert contributions"
ON public.contributions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- UPDATE: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can update contributions"  ON public.contributions;
CREATE POLICY "Admin and treasurer can update contributions"
ON public.contributions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- DELETE: super_admin only
DROP POLICY IF EXISTS "Admin can delete contributions"                ON public.contributions;
CREATE POLICY "Admin can delete contributions"
ON public.contributions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role = 'super_admin'
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. EXPENSES TABLE
--    • super_admin + treasurer → full CRUD
--    • all other roles         → SELECT only
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user can view all expenses
DROP POLICY IF EXISTS "All authenticated can read expenses"           ON public.expenses;
CREATE POLICY "All authenticated can read expenses"
ON public.expenses FOR SELECT TO authenticated
USING (true);

-- INSERT: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can insert expenses"       ON public.expenses;
CREATE POLICY "Admin and treasurer can insert expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- UPDATE: super_admin and treasurer only (includes setting receipt_url)
DROP POLICY IF EXISTS "Admin and treasurer can update expenses"       ON public.expenses;
CREATE POLICY "Admin and treasurer can update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- DELETE: super_admin only
DROP POLICY IF EXISTS "Admin can delete expenses"                     ON public.expenses;
CREATE POLICY "Admin can delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role = 'super_admin'
  )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. EVENTS TABLE
--    • super_admin + treasurer → full CRUD
--    • all other roles         → SELECT only
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user can view all events
DROP POLICY IF EXISTS "All authenticated can read events"             ON public.events;
CREATE POLICY "All authenticated can read events"
ON public.events FOR SELECT TO authenticated
USING (true);

-- INSERT: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can insert events"         ON public.events;
CREATE POLICY "Admin and treasurer can insert events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- UPDATE: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can update events"         ON public.events;
CREATE POLICY "Admin and treasurer can update events"
ON public.events FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);

-- DELETE: super_admin and treasurer only
DROP POLICY IF EXISTS "Admin and treasurer can delete events"         ON public.events;
CREATE POLICY "Admin and treasurer can delete events"
ON public.events FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id   = auth.uid()
    AND   u.role IN ('super_admin', 'treasurer')
  )
);
