-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : fix_rls_v2_correct_role_permissions  (DEFINITIVE VERSION)
--
-- RUN THIS IN:  Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- NOTE: Storage bucket policies (receipts) must be configured separately
--       via Dashboard → Storage → receipts bucket → Policies tab.
--       See instructions in the project README or ask your developer.
--
-- ROLE ACCESS MATRIX
-- ╔══════════════════╦═════════════╦═════════════╦══════════════════════════╗
-- ║ Table            ║ super_admin ║  treasurer  ║ all other roles          ║
-- ╠══════════════════╬═════════════╬═════════════╬══════════════════════════╣
-- ║ users (members)  ║ Full CRUD   ║ Read-only   ║ Own row read + update    ║
-- ║ contributions    ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ║ expenses         ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ║ events           ║ Full CRUD   ║ Full CRUD   ║ Read-only                ║
-- ╚══════════════════╩═════════════╩═════════════╩══════════════════════════╝
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  0.  HELPER FUNCTION — bypasses RLS so policies can check the caller's  ║
-- ║      role without circular-dependency issues.                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  CLEAN-UP — drop every policy created by any previous version so this   ║
-- ║  script is fully idempotent and safe to re-run.                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- users
DROP POLICY IF EXISTS "Users can read own row"                       ON public.users;
DROP POLICY IF EXISTS "Privileged roles can read all users"          ON public.users;
DROP POLICY IF EXISTS "Users can update own row"                     ON public.users;
DROP POLICY IF EXISTS "Privileged roles can update all users"        ON public.users;
DROP POLICY IF EXISTS "Users read own row"                           ON public.users;
DROP POLICY IF EXISTS "Admin and treasurer read all users"           ON public.users;
DROP POLICY IF EXISTS "Users update own row"                         ON public.users;
DROP POLICY IF EXISTS "Admin can update all users"                   ON public.users;
DROP POLICY IF EXISTS "Admin can delete users"                       ON public.users;

-- contributions
DROP POLICY IF EXISTS "Privileged roles can read contributions"      ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can insert contributions"    ON public.contributions;
DROP POLICY IF EXISTS "Privileged roles can update contributions"    ON public.contributions;
DROP POLICY IF EXISTS "All authenticated can read contributions"     ON public.contributions;
DROP POLICY IF EXISTS "Admin and treasurer can insert contributions" ON public.contributions;
DROP POLICY IF EXISTS "Admin and treasurer can update contributions" ON public.contributions;
DROP POLICY IF EXISTS "Admin can delete contributions"               ON public.contributions;

-- expenses
DROP POLICY IF EXISTS "Authenticated users can read expenses"        ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can insert expenses"         ON public.expenses;
DROP POLICY IF EXISTS "Privileged roles can update expenses"         ON public.expenses;
DROP POLICY IF EXISTS "All authenticated can read expenses"          ON public.expenses;
DROP POLICY IF EXISTS "Admin and treasurer can insert expenses"      ON public.expenses;
DROP POLICY IF EXISTS "Admin and treasurer can update expenses"      ON public.expenses;
DROP POLICY IF EXISTS "Admin can delete expenses"                    ON public.expenses;

-- events
DROP POLICY IF EXISTS "Authenticated users can read events"          ON public.events;
DROP POLICY IF EXISTS "Privileged roles can insert events"           ON public.events;
DROP POLICY IF EXISTS "Privileged roles can update events"           ON public.events;
DROP POLICY IF EXISTS "Privileged roles can delete events"           ON public.events;
DROP POLICY IF EXISTS "All authenticated can read events"            ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can insert events"        ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can update events"        ON public.events;
DROP POLICY IF EXISTS "Admin and treasurer can delete events"        ON public.events;

-- audit_logs
DROP POLICY IF EXISTS "Authenticated can read audit logs"            ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs"          ON public.audit_logs;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1.  USERS TABLE (member management)                                    ║
-- ║      super_admin              → full read + write on ALL rows           ║
-- ║      treasurer                → read ALL rows (for member lists)        ║
-- ║      everyone else            → read + update OWN row only              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own row"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin and treasurer read all users"
ON public.users FOR SELECT TO authenticated
USING (public.current_user_role() IN ('super_admin', 'treasurer'));

CREATE POLICY "Users update own row"
ON public.users FOR UPDATE TO authenticated
USING  (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can update all users"
ON public.users FOR UPDATE TO authenticated
USING (public.current_user_role() = 'super_admin');

CREATE POLICY "Admin can delete users"
ON public.users FOR DELETE TO authenticated
USING (public.current_user_role() = 'super_admin');


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2.  CONTRIBUTIONS TABLE                                                ║
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
-- ║  3.  EXPENSES TABLE                                                     ║
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
-- ║  4.  EVENTS TABLE                                                       ║
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
-- ║  5.  AUDIT_LOGS TABLE                                                   ║
-- ║      All authenticated can read + insert (audit trail from any action). ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);
