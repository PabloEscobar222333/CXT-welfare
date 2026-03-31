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

    // ── 4. Generate the one-time recovery link ───────────────────────────────
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;

    const action_link =
      linkData?.properties?.action_link || linkData?.action_link || null;

    // ── 5. Send the reset email via admin client (bypasses rate limit) ───────
    let email_sent  = false;
    let email_error = null;
    try {
      const { error: emailError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      email_sent  = !emailError;
      email_error = emailError?.message ?? null;
    } catch (err: unknown) {
      email_error = err instanceof Error ? err.message : String(err);
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
