import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey  = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase      = createClient(supabaseUrl, supabaseKey);
// Admin client — uses the service role key to bypass RLS and call auth.admin.*
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const authService = {
  async login(email, password) { return supabase.auth.signInWithPassword({ email, password }); },
  async logout() { return supabase.auth.signOut(); }
};

export const memberService = {
  async getAllMembers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      data.forEach(m => {
        m.name     = m.full_name;
        m.memberId = m.member_id;
        m.dateAdded = m.created_at;
      });
    }
    return { data, error };
  },

  // NOTE: Creating a member in the users table requires the user to already exist
  // in auth.users (Supabase Auth). The id MUST match the auth user id.
  // This function is only safe to call after the admin creates an auth account
  // and passes the resulting auth user id as uiData.id.
  async createMember(uiData) {
    if (!uiData.id) {
      throw new Error('Member id (auth user id) is required to create a user profile.');
    }
    const payload = {
      id:        uiData.id,          // must match auth.users id
      full_name: uiData.name,
      member_id: uiData.memberId,
      email:     uiData.email,
      phone:     uiData.phone || null,
      role:      uiData.role   || 'member',
      status:    uiData.status || 'active',
      must_change_password: true,
    };
    return supabase.from('users').insert(payload).select();
  },

  async updateMember(id, uiData) {
    // Build payload only with fields that were actually provided
    // Never overwrite member_id unless explicitly passed
    const payload = {};
    if (uiData.name      !== undefined) payload.full_name  = uiData.name;
    if (uiData.memberId  !== undefined) payload.member_id  = uiData.memberId;
    if (uiData.email     !== undefined) payload.email      = uiData.email;
    if (uiData.phone     !== undefined) payload.phone      = uiData.phone;
    if (uiData.role      !== undefined) payload.role       = uiData.role;
    // Strip out undefined values
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return supabase.from('users').update(payload).eq('id', id);
  },

  async updateMemberStatus(id, newStatus) {
    return supabase.from('users').update({ status: newStatus }).eq('id', id);
  },

  async resetPasswordFlag(id) {
    return supabase.from('users').update({ must_change_password: true }).eq('id', id);
  }
};

export const eventService = {
  async getAllEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });
    if (data) {
      data.forEach(e => {
        e.date   = e.event_date;
        e.budget = e.budget_limit;
      });
    }
    return { data, error };
  },

  async createEvent(uiData) {
    const payload = {
      name:         uiData.name,
      type:         uiData.type,
      event_date:   uiData.date || new Date().toISOString().split('T')[0],
      description:  uiData.description || null,
      organiser:    uiData.organiser    || null,
      budget_limit: uiData.budget       || null,
      status:       uiData.status       || 'upcoming',
    };
    return supabaseAdmin.from('events').insert(payload).select();
  },

  async updateEvent(id, uiData) {
    const payload = {
      name:         uiData.name,
      type:         uiData.type,
      event_date:   uiData.date,
      description:  uiData.description,
      organiser:    uiData.organiser,
      budget_limit: uiData.budget,
      status:       uiData.status,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return supabaseAdmin.from('events').update(payload).eq('id', id);
  },

  async deleteEvent(id) {
    return supabaseAdmin.from('events').delete().eq('id', id);
  }
};

export const expenseService = {
  async getAllExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (data) {
      data.forEach(ex => {
        ex.eventId  = ex.event_id;
        ex.date     = ex.expense_date;
        ex.receipt  = ex.receipt_url  || null;
        ex.paidBy   = ex.paid_by;
        ex.loggedBy = ex.logged_by_id;
      });
    }
    return { data, error };
  },

  async logExpense(uiData) {
    // Guard: only pass a real UUID as logged_by_id.
    // If the user is on a mock/demo session (e.g. id = 'mock-1'), send null instead
    // to avoid a Postgres "invalid input syntax for type uuid" error.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawLoggedBy = uiData.logged_by_id || null;
    const loggedById  = rawLoggedBy && UUID_RE.test(rawLoggedBy) ? rawLoggedBy : null;

    const payload = {
      event_id:     uiData.eventId,
      category:     uiData.category,
      amount:       Number(uiData.amount),
      expense_date: uiData.date || new Date().toISOString().split('T')[0],
      vendor:       uiData.vendor      || null,
      description:  uiData.description,
      paid_by:      uiData.paidBy      || null,
      receipt_url:  uiData.receipt_url || null,
      logged_by_id: loggedById,
    };
    // Use regular client so RLS policies (treasurer/admin only) are enforced
    return supabase.from('expenses').insert(payload).select();
  },

  async updateExpense(id, uiData) {
    const payload = {
      event_id:     uiData.eventId,
      category:     uiData.category,
      amount:       Number(uiData.amount),
      expense_date: uiData.date,
      vendor:       uiData.vendor      || null,
      description:  uiData.description,
      paid_by:      uiData.paidBy      || null,
    };
    // Include receipt_url if explicitly set (e.g. replaced or cleared)
    if (uiData.receipt_url !== undefined) payload.receipt_url = uiData.receipt_url;
    // Remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return supabase.from('expenses').update(payload).eq('id', id).select();
  },

  async updateReceipt(id, url) {
    return supabase.from('expenses').update({ receipt_url: url }).eq('id', id);
  },

  // Upload a receipt file to Supabase Storage and update the expense row.
  // Returns { publicUrl, error }
  async uploadReceipt(expenseId, file) {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED  = ['image/jpeg', 'image/png', 'application/pdf'];

    if (file.size > MAX_SIZE) {
      return { publicUrl: null, error: 'File too large. Maximum size is 5MB.' };
    }
    if (!ALLOWED.includes(file.type)) {
      return { publicUrl: null, error: 'Invalid file type. Only JPG, PNG, and PDF are accepted.' };
    }

    const ext  = file.name.split('.').pop();
    // Flat path avoids folder-level storage RLS issues
    const path = `${expenseId}-${Date.now()}.${ext}`;

    // Step 1: Ensure bucket exists and is PUBLIC
    // createBucket is a no-op if it already exists; updateBucket forces it public
    // even if it was previously created as private.
    await supabaseAdmin.storage.createBucket('receipts', {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    });
    await supabaseAdmin.storage.updateBucket('receipts', {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    });

    // Step 2: Upload the file
    const { error: upErr } = await supabaseAdmin.storage
      .from('receipts')
      .upload(path, file, { upsert: true });

    if (upErr) return { publicUrl: null, error: upErr.message };

    // Step 3: Get the public URL (works because bucket is now public)
    const { data: urlData } = supabaseAdmin.storage.from('receipts').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || path;

    // Step 4: Save the URL back to the expenses table (RLS enforced)
    const { error: dbErr } = await supabase
      .from('expenses')
      .update({ receipt_url: publicUrl })
      .eq('id', expenseId);

    if (dbErr) return { publicUrl: null, error: dbErr.message };
    return { publicUrl, error: null };
  },

  // Upload a receipt file and return the public URL WITHOUT updating the DB row.
  // Used by the edit-expense flow so the URL can be merged into the updateExpense payload.
  // Returns { publicUrl, error }
  async uploadReceiptOnly(expenseId, file) {
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED  = ['image/jpeg', 'image/png', 'application/pdf'];
    if (file.size > MAX_SIZE)       return { publicUrl: null, error: 'File too large. Max 5MB.' };
    if (!ALLOWED.includes(file.type)) return { publicUrl: null, error: 'Only JPG, PNG or PDF accepted.' };

    const ext  = file.name.split('.').pop();
    const path = `${expenseId}-${Date.now()}.${ext}`;

    // Force bucket to exist and be public
    await supabaseAdmin.storage.createBucket('receipts', { public: true, fileSizeLimit: 5242880 });
    await supabaseAdmin.storage.updateBucket('receipts', { public: true, fileSizeLimit: 5242880 });

    const { error: upErr } = await supabaseAdmin.storage
      .from('receipts')
      .upload(path, file, { upsert: true });
    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data: urlData } = supabaseAdmin.storage.from('receipts').getPublicUrl(path);
    return { publicUrl: urlData?.publicUrl || path, error: null };
  },

  async deleteExpense(id) {
    return supabaseAdmin.from('expenses').delete().eq('id', id);
  }
};

export const contributionService = {
  async getAllContributions() {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      data.forEach(c => {
        c.memberId = c.member_id;
        c.expected = Number(c.expected_amount);
        c.paid     = Number(c.paid_amount);    // DB column is paid_amount
        c.date     = c.payment_date;
        c.method   = c.payment_method;
      });
    }
    return { data, error };
  },

  // Fetch all contributions for a specific month/year (with member info)
  async getContributionsByMonth(month, year) {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('month', month)
      .eq('year', year);
    return { data: data || [], error };
  },

  // Fetch active members with role='member' from the users table
  async getActiveMembers() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, member_id, role, status')
      .eq('status', 'active')
      .eq('role', 'member')
      .order('full_name', { ascending: true });
    return { data: data || [], error };
  },

  // Get the contribution_settings row effective on or before a given date
  async getContributionSettings(effectiveDate) {
    const { data, error } = await supabase
      .from('contribution_settings')
      .select('*')
      .lte('effective_from', effectiveDate)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  },

  // Upsert a contribution row
  async upsertContribution(payload) {
    return supabase
      .from('contributions')
      .upsert(payload, { onConflict: 'member_id,month,year' })
      .select()
      .single();
  },

  // Fetch grouped history (month/year summaries)
  async getContributionHistory() {
    const { data, error } = await supabase
      .from('contributions')
      .select('month, year, expected_amount, paid_amount, status, member_id');
    return { data: data || [], error };
  },

  // Fetch all contributions for history drill-down
  // Note: join uses foreign key relationship name — adjust if PostgREST reports different FK name
  async getContributionsByMonthYear(month, year) {
    const { data, error } = await supabase
      .from('contributions')
      .select('*, users(full_name, member_id)')
      .eq('month', month)
      .eq('year', year);
    return { data: data || [], error };
  },

  async logContribution(uiData) {
    const payload = {
      member_id:       uiData.memberId,
      month:           Number(uiData.month),
      year:            Number(uiData.year),
      expected_amount: Number(uiData.expected),
      paid_amount:     Number(uiData.paid),   // DB column is paid_amount
      payment_date:    uiData.date   || null,
      payment_method:  uiData.method || null,
      status:          uiData.status,
      updated_at:      new Date().toISOString(),
    };
    return supabase
      .from('contributions')
      .upsert(payload, { onConflict: 'member_id,month,year' })
      .select()
      .single();
  },

  async updateContributionStatus(id, status) {
    return supabase.from('contributions').update({ status }).eq('id', id);
  }
};

export const auditService = {
  async logAction(userId, actionType, details, ipAddress = '127.0.0.1') {
    return supabase
      .from('audit_logs')
      .insert({
        user_id:     userId,
        action_type: actionType,
        description: details,
        ip_address:  ipAddress,
      });
  },

  async getLogs() {
    return supabase
      .from('audit_logs')
      .select(`*, users(full_name, role)`)
      .order('created_at', { ascending: false });
  }
};

// ─── Profile Service (profiles table — Members page) ──────────────────────────
export const profileService = {

  // NOTE: Uses the `users` table (matches auth.users via id foreign key).
  // The `profiles` table referenced in the spec does not yet exist in this project;
  // `users` has identical columns and is the live data source for the whole app.
  TABLE: 'users',

  // Fetch all users ordered by creation date
  async getAllProfiles() {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      data.forEach(p => {
        p.name     = p.full_name;
        p.memberId = p.member_id;
      });
    }
    return { data: data || [], error };
  },

  // Check if an email is already registered
  async checkEmailExists(email) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return { exists: !!data, error };
  },

  // Find the next available WEL-NNN member ID
  async getNextMemberId() {
    const { data } = await supabaseAdmin
      .from('users')
      .select('member_id')
      .like('member_id', 'WEL-%')
      .order('member_id', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const last = data[0].member_id;
      const num  = parseInt(last.replace('WEL-', ''), 10) || 0;
      return `WEL-${String(num + 1).padStart(3, '0')}`;
    }
    return 'WEL-001';
  },

  // Create auth user via admin API + insert users row
  async createAuthAndProfile(uiData, createdById) {
    const tempPassword = `Welfare@${Math.random().toString(36).slice(-6)}!9`;

    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email:         uiData.email,
      password:      tempPassword,
      email_confirm: true,
    });
    if (adminError) throw adminError;
    const authUserId = adminData?.user?.id;
    if (!authUserId) throw new Error('Supabase did not return a user id.');

    // Insert into users table (matching the existing schema)
    const { data, error } = await supabaseAdmin.from('users').insert({
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
    return data;
  },

  // Update editable fields — never touches member_id or email
  async updateProfile(id, uiData) {
    const payload = {};
    if (uiData.name  !== undefined) payload.full_name = uiData.name;
    if (uiData.phone !== undefined) payload.phone     = uiData.phone;
    if (uiData.role  !== undefined) payload.role      = uiData.role;
    const { error } = await supabaseAdmin.from('users').update(payload).eq('id', id);
    return { error };
  },

  // Toggle status
  async updateProfileStatus(id, status) {
    const { error } = await supabaseAdmin.from('users').update({ status }).eq('id', id);
    return { error };
  },

  // Admin-initiated password reset (two-phase):
  //
  // Phase 1 — Always succeeds:
  //   generateLink() via the service-role admin API generates a direct
  //   shareable one-time recovery URL for the admin to copy/share.
  //
  // Phase 2 — Email delivery:
  //   Uses the ADMIN client (service role key) to call resetPasswordForEmail.
  //   This bypasses the 60-second per-email rate limit that Supabase enforces
  //   on the public anon endpoint. The admin client is not subject to this
  //   rate limit, so emails are sent immediately even right after account creation.
  //
  // Returns: { data: { action_link, email_sent, email_error }, error }
  async resetPassword(email) {
    const redirectTo = `${window.location.origin}/reset-password`;

    // Phase 1: generate the admin-shareable recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkError) return { data: null, error: linkError };

    const action_link =
      linkData?.properties?.action_link || linkData?.action_link || null;

    // Phase 2: send the password reset email via the ADMIN client.
    // Using supabaseAdmin (service role) instead of supabase (anon) avoids the
    // Supabase "For security purposes, you can only request this after N seconds"
    // rate-limit error that is enforced exclusively on the public anon endpoint.
    let email_sent = false;
    let email_error = null;
    try {
      const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
      if (emailError) {
        email_sent = false;
        email_error = emailError.message || String(emailError);
        console.error('[resetPassword] Email delivery failed:', emailError);
      } else {
        email_sent = true;
      }
    } catch (err) {
      email_sent = false;
      email_error = err.message || String(err);
      console.error('[resetPassword] Email delivery exception:', err);
    }

    return { data: { action_link, email_sent, email_error }, error: null };
  },

  // Audit log entry
  async logAuditEntry(userId, actionType, description) {
    await supabaseAdmin.from('audit_logs').insert({
      user_id:     userId,
      action_type: actionType,
      description: description,
      ip_address:  '127.0.0.1',
    });
  },
};

