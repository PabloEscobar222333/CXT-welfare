// supabase/functions/reset-password/index.ts
// Runs server-side (Deno). Generates a recovery link + sends reset email.
// The SERVICE_ROLE_KEY stays server-side only.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify the caller is authenticated ────────────────────────────────
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

    // ── 2. Verify caller is an admin role ────────────────────────────────────
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

    // ── 3. Parse request body ────────────────────────────────────────────────
    const { email, redirectTo } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Generate the recovery token (does NOT send email by itself) ────────
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

    // ── 5. Trigger the recovery email via the Supabase Auth REST API ──────────
    // generateLink alone does NOT send any email. The /auth/v1/recover endpoint
    // actually dispatches the Supabase recovery email (uses the SMTP config in
    // your project settings). If SMTP is not configured the email won't arrive
    // but the link above can still be copied and shared manually.
    let email_sent  = false;
    let email_error: string | null = null;
    try {
      const recoverUrl = `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`;
      const recoverResp = await fetch(
        recoverUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            email,
            gotrue_meta_security: {},
          }),
        },
      );
      // /auth/v1/recover returns 200 (or 204) on success
      email_sent  = recoverResp.ok;
      if (!recoverResp.ok) {
        const body = await recoverResp.text().catch(() => '');
        email_error = body || `HTTP ${recoverResp.status}`;
      }
    } catch (emailErr: unknown) {
      email_error = emailErr instanceof Error ? emailErr.message : String(emailErr);
    }

    // ── 6. Audit log ─────────────────────────────────────────────────────────
    const clientIp =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      'unknown';

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
