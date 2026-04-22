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

    // ── 4. Check for existing profile in the users table ─────────────────────
    const { data: existingProfile } = await admin
      .from('users')
      .select('id')
      .eq('email', uiData.email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({ error: 'A member with this email already exists in the system.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Generate a cryptographically secure temp password (12 chars) ─────
    // Character set excludes ambiguous chars (I, l, O, 0, 1) for readability.
    const pwChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    const tempPassword = Array.from(arr).map(b => pwChars[b % pwChars.length]).join('');

    // ── 6. Create the auth user (with orphan recovery) ───────────────────────
    // If a previous create-member call partially succeeded (auth user was
    // created in auth.users but the public.users insert failed), the orphaned
    // auth record blocks retries with "User already registered".
    // Strategy: attempt creation → if duplicate, delete the orphan → retry once.
    let authUserId: string;

    const attemptCreate = async () => {
      return admin.auth.admin.createUser({
        email:         uiData.email,
        password:      tempPassword,
        email_confirm: true,
      });
    };

    let { data: adminData, error: adminError } = await attemptCreate();

    if (adminError && adminError.message?.toLowerCase().includes('already registered')) {
      // Orphaned auth user detected — look it up and delete it, then retry.
      const { data: lookupData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const orphan = lookupData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === uiData.email.toLowerCase()
      );
      if (orphan) {
        await admin.auth.admin.deleteUser(orphan.id);
      }
      // Retry creation after cleanup
      const retry = await attemptCreate();
      adminData  = retry.data;
      adminError = retry.error;
    }

    if (adminError) throw adminError;
    authUserId = adminData?.user?.id!;
    if (!authUserId) throw new Error('Supabase did not return a user id.');

    // ── 8. Insert the users profile row ─────────────────────────────────────
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

    // ── 9. Audit log with real client IP ─────────────────────────────────────
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
