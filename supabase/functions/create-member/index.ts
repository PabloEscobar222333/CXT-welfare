// supabase/functions/create-member/index.ts
// Runs server-side (Deno). Creates a Supabase auth user + inserts a users row.
// The SERVICE_ROLE_KEY is a server-only env var — never sent to the browser.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle preflight
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

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey         = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller's JWT using the anon client
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
    const { data: callerProfile, error: profileErr } = await admin
      .from('users')
      .select('role, status')
      .eq('id', caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Could not verify caller role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedRoles = ['super_admin', 'admin', 'secretary', 'treasurer'];
    if (!allowedRoles.includes(callerProfile.role) || callerProfile.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Parse request body ────────────────────────────────────────────────
    const uiData = await req.json();

    // ── 4. Generate a cryptographically secure temp password (12 chars) ─────
    // Character set excludes ambiguous chars (I, l, O, 0, 1) for readability.
    const pwChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    const tempPassword = Array.from(arr).map(b => pwChars[b % pwChars.length]).join('');

    // ── 5. Create the auth user ──────────────────────────────────────────────
    const { data: adminData, error: adminError } = await admin.auth.admin.createUser({
      email:         uiData.email,
      password:      tempPassword,
      email_confirm: true,
    });
    if (adminError) throw adminError;
    const authUserId = adminData?.user?.id;
    if (!authUserId) throw new Error('Supabase did not return a user id.');

    // ── 6. Insert the users profile row ─────────────────────────────────────
    const { data, error } = await admin.from('users').insert({
      id:                   authUserId,
      full_name:            uiData.name,
      member_id:            uiData.memberId,
      email:                uiData.email,
      phone:                uiData.phone     || null,
      role:                 uiData.role      || 'member',
      status:               'active',
      must_change_password: true,
    }).select().single();
    if (error) throw error;

    // ── 7. Audit log with real client IP ─────────────────────────────────────
    const clientIp =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      'unknown';

    await admin.from('audit_logs').insert({
      user_id:     caller.id,
      action_type: 'Member Created',
      description: JSON.stringify({ new_member_email: uiData.email, new_member_id: authUserId }),
      ip_address:  clientIp,
    });

    return new Response(JSON.stringify({ data, tempPassword }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
