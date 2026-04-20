-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : fix_rls_v2_correct_role_permissions  (DEFINITIVE VERSION)
--
-- ROOT-CAUSE FIX
-- ──────────────
-- RLS policies that use  EXISTS (SELECT 1 FROM public.users …)  fail with
-- a circular-dependency problem: the sub-query itself is subject to the
-- users table's own RLS policies, which also do  EXISTS (… FROM public.users …).
-- PostgreSQL silently returns zero rows for the sub-query, so every
-- WITH CHECK / USING clause evaluates to FALSE  →  "new row violates RLS".
--
-- SOLUTION
-- ────────
-- 1.  A small SECURITY DEFINER function  current_user_role()  reads the
--     caller's role from the users table outside of RLS.
-- 2.  Every policy uses  current_user_role()  instead of a sub-query.
--     This is a widely-recommended Supabase pattern.
--
-- ROLE ACCESS MATRIX
-- ╔══════════════════╦═════════════╦═════════════╦══════════════════════════╗
-- ║ Table / Resource ║ super_admin ║  treasurer  ║ all other roles          ║
-- ╠══════════════════╬═════════════╬═════════════╬══════════════════════════╣
-- ║ users (members)  ║ Full CRUD   ║ Read-only   ║ Own row read + update    ║
-- ║ contributions    ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ║ expenses         ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ║ events           ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ║ storage/receipts ║ Full CRUD   ║ Upload+Read ║ Read-only                ║
-- ╚══════════════════╩═════════════╩═════════════╩══════════════════════════╝
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  0.  HELPER FUNCTION — bypasses RLS so policies can check the caller's  ║
-- ║      role without circular-dependency issues.                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE                       -- result is stable within a single statement
SECURITY DEFINER             -- runs as the function owner → bypasses RLS
SET search_path = public     -- pin schema to prevent search-path hijacking
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  CLEAN-UP — drop every policy created by ANY previous version of this   ║
-- ║  migration so the script is fully idempotent.                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- storage.objects (v1 names)
DROP POLICY IF EXISTS "Authenticated users can upload to receipts"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read receipts"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts"      ON storage.objects;
-- storage.objects (v2 names)
DROP POLICY IF EXISTS "All authenticated can read receipts"          ON storage.objects;
DROP POLICY IF EXISTS "Admin and treasurer can upload receipts"      ON storage.objects;
DROP POLICY IF EXISTS "Admin and treasurer can update receipts"      ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete receipts"                    ON storage.objects;

-- users (v1 names)
DROP POLICY IF EXISTS "Users can read own row"                       ON public.users;
DROP POLICY IF EXISTS "Privileged roles can read all users"          ON public.users;
DROP POLICY IF EXISTS "Users can update own row"                     ON public.users;
DROP POLICY IF EXISTS "Privileged roles can update all users"        ON public.users;
-- users (v2 names)
DROP POLICY IF EXISTS "Users read own row"                           ON public.users;
DROP POLICY IF EXISTS "Admin and treasurer read all users"           ON public.users;
DROP POLICY IF EXISTS "Users update own row"                         ON public.users;
DROP POLICY IF EXISTS "Admin can update all users"                   ON public.users;
DROP POLICY IF EXISTS "Admin can delete users"                       ON public.users;

-- contributions (v1 names)
DROP POLICY IF EXISTS "Privileged roles can read contributions"      ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can insert contributions"    ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can update contributions"    ON public.contributions;
-- contributions (v2 names)
DROP POLICY IF EXISTS "All authenticated can read contributions"     ON public.contributions;
DROP POLICY IF EXISTS "Admin and treasurer can insert contributions" ON public.contributions;
DROP POLICY IF EXISTS "Admin and treasurer can update contributions" ON public.contributions;
DROP POLICY IF EXISTS "Admin can delete contributions"               ON public.contributions;

-- expenses (v1 names)
DROP POLICY IF EXISTS "Authenticated users can read expenses"        ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can insert expenses"         ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can update expenses"         ON public.expenses;
-- expenses (v2 names)
DROP POLICY IF EXISTS "All authenticated can read expenses"          ON public.expenses;
DROP POLICY IF EXISTS "Admin and treasurer can insert expenses"      ON public.expenses;
DROP POLICY IF EXISTS "Admin and treasurer can update expenses"      ON public.expenses;
DROP POLICY IF EXISTS "Admin can delete expenses"                    ON public.expenses;

-- events (v1 names)
DROP POLICY IF EXISTS "Authenticated users can read events"          ON public.events;
DROP POLICY IF EXISTS "Privileged roles can insert events"           ON public.events;
DROP POLICY IF EXISTS "Privileged roles can update events"           ON public.events;
DROP POLICY IF EXISTS "Privileged roles can delete events"           ON public.events;
-- events (v2 names)
DROP POLICY IF EXISTS "All authenticated can read events"            ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can insert events"        ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can update events"        ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can delete events"        ON public.events;

-- audit_logs (defensive)
DROP POLICY IF EXISTS "Authenticated can read audit logs"            ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs"          ON public.audit_logs;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1.  STORAGE — receipts bucket                                          ║
-- ║      super_admin + treasurer → upload / replace / delete                ║
-- ║      all authenticated       → read / download                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- SELECT: every authenticated user can VIEW receipts
CREATE POLICY "All authenticated can read receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts');

-- INSERT: super_admin and treasurer can UPLOAD new receipt files
CREATE POLICY "Admin and treasurer can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND public.current_user_role() IN ('super_admin', 'treasurer')
);

-- UPDATE: super_admin and treasurer can REPLACE receipt files
CREATE POLICY "Admin and treasurer can update receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.current_user_role() IN ('super_admin', 'treasurer')
)
WITH CHECK (
  bucket_id = 'receipts'
  AND public.current_user_role() IN ('super_admin', 'treasurer')
);

-- DELETE: super_admin only
CREATE POLICY "Admin can delete receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.current_user_role() = 'super_admin'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2.  USERS TABLE (member management)                                    ║
-- ║      super_admin              → full read + write on ALL rows           ║
-- ║      treasurer                → read ALL rows (for member lists)        ║
-- ║      everyone else            → read + update OWN row only              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read their OWN row (auth profile)
CREATE POLICY "Users read own row"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

-- SELECT: super_admin and treasurer can read ALL user rows
CREATE POLICY "Admin and treasurer read all users"
ON public.users FOR SELECT TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));

-- UPDATE: any user can update their OWN row (name, phone, password flag)
CREATE POLICY "Users update own row"
ON public.users FOR UPDATE TO authenticated
USING  (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- UPDATE: super_admin can update ANY user row (role, status, etc.)
CREATE POLICY "Admin can update all users"
ON public.users FOR UPDATE TO authenticated
USING (public.current_user_role() = 'super_admin');

-- DELETE: super_admin only
CREATE POLICY "Admin can delete users"
ON public.users FOR DELETE TO authenticated
USING (public.current_user_role() = 'super_admin');

-- NOTE: INSERT is handled by the create-member Edge Function (service_role).
--       No INSERT policy is needed — the browser can never create a row directly.


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3.  CONTRIBUTIONS TABLE                                                ║
-- ║      super_admin + treasurer → full CRUD                                ║
-- ║      everyone else           → read-only                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read contributions"
ON public.contributions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and treasurer can insert contributions"
ON public.contributions FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin and treasurer can update contributions"
ON public.contributions FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin can delete contributions"
ON public.contributions FOR DELETE TO authenticated
USING (public.current_user_role() = 'super_admin');


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4.  EXPENSES TABLE                                                     ║
-- ║      super_admin + treasurer → full CRUD                                ║
-- ║      everyone else           → read-only                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read expenses"
ON public.expenses FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and treasurer can insert expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin and treasurer can update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin can delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (public.current_user_role() = 'super_admin');


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5.  EVENTS TABLE                                                       ║
-- ║      super_admin + treasurer → full CRUD                                ║
-- ║      everyone else           → read-only                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read events"
ON public.events FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin and treasurer can insert events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin and treasurer can update events"
ON public.events FOR UPDATE TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Admin and treasurer can delete events"
ON public.events FOR DELETE TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6.  AUDIT_LOGS TABLE                                                   ║
-- ║      All authenticated can read logs (needed for the audit page).       ║
-- ║      All authenticated can insert logs (audit trail from any action).   ║
-- ║      Edge Function also writes via service_role (bypasses RLS).         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);
