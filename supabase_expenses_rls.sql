-- ============================================================
-- WELFARE PLATFORM — EXPENSES RLS (Role-Restricted)
-- Run this in the Supabase SQL Editor to replace the
-- open-access expense policies with role-restricted ones.
--
-- Access rules:
--   SELECT  → any authenticated user  (read-only for all)
--   INSERT  → treasurer, admin, super_admin
--   UPDATE  → treasurer, admin, super_admin
--   DELETE  → admin, super_admin only
-- ============================================================

-- Make sure RLS is enabled
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ── Drop old open-access policies (if they exist) ────────────
DROP POLICY IF EXISTS "expenses_select_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_all" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_all" ON public.expenses;

-- Also drop any legacy names from original schema
DROP POLICY IF EXISTS "Allow internal read access"    ON public.expenses;
DROP POLICY IF EXISTS "Allow internal update by admins" ON public.expenses;

-- ── Helper: get current user's role from public.users ────────
-- Supabase sets auth.uid() to the logged-in user's UUID.
-- We look up their role from the users table.

-- ── SELECT: all authenticated users may read expenses ────────
CREATE POLICY "expenses_select_authenticated"
  ON public.expenses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── INSERT: treasurer, admin, super_admin only ───────────────
CREATE POLICY "expenses_insert_privileged"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'admin', 'super_admin')
        AND u.status = 'active'
    )
  );

-- ── UPDATE: treasurer, admin, super_admin only ───────────────
CREATE POLICY "expenses_update_privileged"
  ON public.expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'admin', 'super_admin')
        AND u.status = 'active'
    )
  );

-- ── DELETE: admin and super_admin only ───────────────────────
CREATE POLICY "expenses_delete_admin"
  ON public.expenses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
        AND u.status = 'active'
    )
  );

-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';
