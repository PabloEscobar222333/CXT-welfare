// supabase/functions/reset-password/index.ts
// Runs server-side (Deno). Generates a new temporary password for an existing user.
// The SERVICE_ROLE_KEY stays server-side only.
//
// This function is restricted to super_admin only (not broader admin roles).
// It replaces the old recovery-link/email flow with direct password update.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate a cryptographically secure temporary password.
 * 12 characters from a set that excludes ambiguous characters (I, l, O, 0, 1).
 */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => chars[b % chars.length])
    .join('');
}

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

    // ── 2. Verify caller is super_admin ────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerProfile } = await admin
      .from('users')
      .select('role, status, full_name')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'super_admin' || callerProfile.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Forbidden: only super admins can reset passwords' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Parse request body ──────────────────────────────────────────────────
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Look up the target user ─────────────────────────────────────────────
    const { data: targetUser, error: targetErr } = await admin
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (targetErr || !targetUser) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Generate temporary password ─────────────────────────────────────────
    const tempPassword = generateTemporaryPassword();

    // ── 6. Update the user's Supabase Auth password ────────────────────────────
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (updateErr) throw updateErr;

    // ── 7. Set must_change_password = true in users table ──────────────────────
    const { error: flagErr } = await admin
      .from('users')
      .update({ must_change_password: true })
      .eq('id', userId);
    if (flagErr) throw flagErr;

    // ── 8. Audit log ───────────────────────────────────────────────────────────
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    await admin.from('audit_logs').insert({
      user_id:     caller.id,
      action_type: 'Temporary Password Reset',
      description: JSON.stringify({
        target_user_id:   userId,
        target_user_name: targetUser.full_name,
        target_email:     targetUser.email,
        admin_name:       callerProfile.full_name,
      }),
      ip_address: clientIp,
    });

    // ── 9. Return the temporary password (one-time, over HTTPS) ────────────────
    return new Response(
      JSON.stringify({ data: { tempPassword, targetUserName: targetUser.full_name } }),
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
