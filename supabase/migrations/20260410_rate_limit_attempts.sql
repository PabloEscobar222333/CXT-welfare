-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: rate_limit_attempts
-- Purpose  : Persistent backing store for the sliding-window rate limiter
--            inside the reset-password Edge Function.
--
-- Each row represents one password-reset attempt.
-- Rows expire automatically — the edge function deletes rows older than the
-- window (15 min) on every call, so the table stays small over time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- SHA-256 hex of the normalised email, or the raw client IP.
  -- Stored as a hash so no PII (email addresses) are persisted in plain text.
  key          TEXT        NOT NULL,

  -- Discriminator: 'email' | 'ip'
  key_type     TEXT        NOT NULL CHECK (key_type IN ('email', 'ip')),

  -- Wall-clock time of the attempt (used for the sliding window).
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index: all rate-limit queries filter on (key, key_type, attempted_at).
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time
  ON public.rate_limit_attempts (key, key_type, attempted_at DESC);

-- This table is internal-only — written exclusively by Edge Functions that
-- already hold the service role key. Disable RLS so service-role writes
-- bypass the policy engine without needing an explicit BYPASS RLS grant.
ALTER TABLE public.rate_limit_attempts DISABLE ROW LEVEL SECURITY;

-- Revoke public read access (extra safety — RLS is off but access is still denied
-- to anonymous callers at the permission level).
REVOKE ALL ON public.rate_limit_attempts FROM anon, authenticated;
GRANT ALL  ON public.rate_limit_attempts TO service_role;
