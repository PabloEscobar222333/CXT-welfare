// supabase/functions/reset-password/index.ts
// Runs server-side (Deno). Generates a recovery link + sends reset email.
// The SERVICE_ROLE_KEY stays server-side only.
//
// Rate limiting (sliding window, persisted in `rate_limit_attempts` table):
//   • Max 3 requests per email  per 15 minutes
//   • Max 5 requests per IP     per 15 minutes
// Email addresses are SHA-256 hashed before storage (no PII at rest).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Constants ────────────────────────────────────────────────────────────────
const WINDOW_MS     = 15 * 60 * 1000;  // 15-minute sliding window
const MAX_PER_EMAIL = 3;               // max resets per unique email per window
const MAX_PER_IP    = 5;               // max resets per IP address per window
const RL_TABLE      = 'rate_limit_attempts';
const RL_MSG        = 'Too many password reset attempts. Please try again later.';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * SHA-256 hex digest via the Web Crypto API (built into Deno).
 * Used to hash email addresses so no PII is stored in the rate-limit table.
 */
async function sha256(input: string): Promise<string> {
  const data   = new TextEncoder().encode(input.toLowerCase().trim());
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type AdminClient = ReturnType<typeof createClient>;

/**
 * Sliding-window rate-limit check.
 *
 * 1. Deletes rows for this key that are older than the window (auto-expiration).
 * 2. Counts remaining rows (i.e. attempts inside the window).
 * 3. Returns { allowed, count }.
 *
 * Fails open on DB errors — a transient database hiccup should not lock out
 * legitimate admins.
 */
async function checkRateLimit(
  admin:       AdminClient,
  key:         string,
  keyType:     'email' | 'ip',
  maxRequests: number,
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  // Step 1 — purge expired rows for this key (keeps the table lean).
  const { error: delErr } = await admin
    .from(RL_TABLE)
    .delete()
    .eq('key',      key)
    .eq('key_type', keyType)
    .lt('attempted_at', windowStart);

  if (delErr) {
    console.warn(`[rate-limit] cleanup error (${keyType}):`, delErr.message);
  }

  // Step 2 — count attempts still inside the sliding window.
  const { count, error: cntErr } = await admin
    .from(RL_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('key',      key)
    .eq('key_type', keyType)
    .gte('attempted_at', windowStart);

  if (cntErr) {
    console.warn(`[rate-limit] count error (${keyType}):`, cntErr.message);
    return { allowed: true, count: 0 };  // fail open
  }

  const current = count ?? 0;
  return { allowed: current < maxRequests, count: current };
}

/**
 * Record a new attempt for the given key.
 * Called once — AFTER both email and IP checks pass — so one row per
 * successful (allowed) request is inserted, covering both key types.
 */
async function recordAttempt(
  admin:   AdminClient,
  key:     string,
  keyType: 'email' | 'ip',
): Promise<void> {
  const { error } = await admin
    .from(RL_TABLE)
    .insert({ key, key_type: keyType, attempted_at: new Date().toISOString() });

  if (error) {
    console.warn(`[rate-limit] insert error (${keyType}):`, error.message);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify the caller is authenticated ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Verify caller is an admin role ──────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerProfile } = await admin
      .from('users')
      .select('role, status')
      .eq('id', caller.id)
      .single();

    const allowedRoles = ['super_admin', 'admin', 'secretary'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role) || callerProfile.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Parse request body ──────────────────────────────────────────────────
    const { email, redirectTo } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Rate limiting (sliding window, persisted) ───────────────────────────
    //
    // Extract the client IP — Edge Functions receive x-forwarded-for from the
    // Supabase proxy; take only the first (leftmost) address to avoid spoofing
    // via appended IPs.
    const rawIp    = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const clientIp = rawIp.split(',')[0].trim();

    // Hash the email for privacy — no plain-text PII stored in the RL table.
    const emailHash = await sha256(email);

    // Run both checks (email & IP) concurrently for performance.
    const [emailCheck, ipCheck] = await Promise.all([
      checkRateLimit(admin, emailHash, 'email', MAX_PER_EMAIL),
      checkRateLimit(admin, clientIp,  'ip',    MAX_PER_IP),
    ]);

    const rateLimited = !emailCheck.allowed || !ipCheck.allowed;

    if (rateLimited) {
      // ── Log the violation for monitoring ──────────────────────────────────
      const violationType = !emailCheck.allowed
        ? `email (${emailCheck.count}/${MAX_PER_EMAIL} attempts)`
        : `ip (${ipCheck.count}/${MAX_PER_IP} attempts)`;

      await admin.from('audit_logs').insert({
        user_id:     caller.id,
        action_type: 'Rate Limit Violation',
        description: JSON.stringify({
          violation:    violationType,
          target_email: email,   // email is logged here; it is NOT stored in the RL table
          ip_address:   clientIp,
          window_ms:    WINDOW_MS,
        }),
        ip_address: clientIp,
      });

      return new Response(
        JSON.stringify({ error: RL_MSG }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type':  'application/json',
            'Retry-After':   String(Math.ceil(WINDOW_MS / 1000)),
            'X-RateLimit-Limit-Email': String(MAX_PER_EMAIL),
            'X-RateLimit-Limit-IP':   String(MAX_PER_IP),
          },
        },
      );
    }

    // ── Record this attempt for both keys (one row each, done in parallel) ────
    // Recorded BEFORE the expensive operations below so the slot is consumed
    // even if the downstream call fails — prevents retry-flood bypass.
    await Promise.all([
      recordAttempt(admin, emailHash, 'email'),
      recordAttempt(admin, clientIp,  'ip'),
    ]);

    // ── 5. Generate the recovery token (does NOT send email by itself) ─────────
    // admin.auth.admin.generateLink only creates the signed token — it never
    // dispatches an email. We extract the hashed_token and build our own
    // direct link so the member lands on /reset-password without needing
    // Supabase's redirect URL allowlist.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;

    // Build a direct app link using the hashed_token — bypasses Supabase's
    // redirect validator entirely so it always points to our /reset-password.
    const hashed_token = linkData?.properties?.hashed_token;
    const action_link  = hashed_token
      ? `${redirectTo}#access_token=${hashed_token}&token_type=bearer&type=recovery`
      : (linkData?.properties?.action_link || linkData?.action_link || null);

    // ── 6. Trigger the recovery email via the Supabase Auth REST API ───────────
    // generateLink alone does NOT send any email. The /auth/v1/recover endpoint
    // actually dispatches the Supabase recovery email (uses the SMTP config in
    // your project settings). If SMTP is not configured the email won't arrive
    // but the link above can still be copied and shared manually.
    let email_sent  = false;
    let email_error: string | null = null;
    try {
      const recoverUrl  = `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`;
      const recoverResp = await fetch(recoverUrl, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ email, gotrue_meta_security: {} }),
      });
      // /auth/v1/recover returns 200 (or 204) on success
      email_sent = recoverResp.ok;
      if (!recoverResp.ok) {
        const body  = await recoverResp.text().catch(() => '');
        email_error = body || `HTTP ${recoverResp.status}`;
      }
    } catch (emailErr: unknown) {
      email_error = emailErr instanceof Error ? emailErr.message : String(emailErr);
    }

    // ── 7. Audit log (success) ─────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id:     caller.id,
      action_type: 'Password Reset Initiated',
      description: JSON.stringify({ target_email: email, email_sent }),
      ip_address:  clientIp,
    });

    return new Response(
      JSON.stringify({ data: { action_link, email_sent, email_error } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
