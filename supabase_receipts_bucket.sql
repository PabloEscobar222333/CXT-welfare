-- ============================================================
-- WELFARE PLATFORM — RECEIPTS STORAGE BUCKET SETUP
-- Run this in the Supabase SQL Editor to confirm the receipts
-- bucket exists and has correct storage RLS policies.
-- ============================================================

-- ── Step 1: Create the receipts bucket if it doesn't exist ───
-- (If bucket already exists this is a no-op)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,                              -- public bucket so receipt URLs are readable
  5242880,                           -- 5 MB max file size
  ARRAY['image/jpeg','image/png','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','application/pdf'];

-- ── Step 2: Storage object RLS policies for receipts bucket ──
-- Note: The app uses the service-role (admin) client for uploads,
-- which bypasses storage RLS. These policies cover the regular client
-- for public reads and any future direct client uploads.

-- Drop old policies if any
DROP POLICY IF EXISTS "receipts_public_read"         ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_admin_delete"         ON storage.objects;

-- Public read (so receipt image URLs work in browser)
CREATE POLICY "receipts_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

-- Authenticated users may upload receipts
CREATE POLICY "receipts_authenticated_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

-- Authenticated users may update/replace receipt files
CREATE POLICY "receipts_authenticated_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

-- Admin/super_admin may delete receipt files
CREATE POLICY "receipts_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

-- ── Reload schema cache ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
