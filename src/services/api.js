import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only the anon client is used in the browser.
// Admin/service-role operations are handled by Supabase Edge Functions (server-side).
export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helper: call an Edge Function with an explicit Authorization header ──────
// We explicitly get the session token and send it as a raw fetch instead of
// relying on supabase.functions.invoke, which has been observed to silently
// fail to attach the JWT, causing 401 "Invalid JWT" errors from the edge runtime.
async function callEdgeFunction(name, body) {
  // Step 1: Always try to refresh the session first to ensure a fresh token.
  // This prevents "Invalid JWT" errors caused by stale/expired tokens.
  let token = null;

  try {
    const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
    if (!refreshErr && refreshData?.session?.access_token) {
      token = refreshData.session.access_token;
    }
  } catch (_) {
    // Refresh failed — fall through to getSession.
  }

  // Step 2: If refresh didn't yield a token, fall back to getSession.
  if (!token) {
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData?.session?.access_token;
  }

  if (!token) {
    throw new Error('No active session. Please log in again.');
  }

  // Step 3: Build the Edge Function URL from the Supabase project URL.
  const fnUrl = `${supabaseUrl}/functions/v1/${name}`;

  // Step 4: Fire the request with explicit headers so the JWT is guaranteed to reach the edge function.
  const response = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify(body),
  });

  // Step 5: Parse the JSON response.
  let json;
  try {
    json = await response.json();
  } catch (_) {
    throw new Error(`Edge function ${name} returned a non-JSON response (status ${response.status}).`);
  }

  if (!response.ok) {
    const errMsg = json?.error || json?.message || `Edge function ${name} failed with status ${response.status}.`;
    console.error(`[callEdgeFunction] ${name} failed:`, errMsg, json);
    throw new Error(errMsg);
  }

  return json;
}

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

  async updateMember(id, uiData) {
    const payload = {};
    if (uiData.name      !== undefined) payload.full_name  = uiData.name;
    if (uiData.memberId  !== undefined) payload.member_id  = uiData.memberId;
    if (uiData.email     !== undefined) payload.email      = uiData.email;
    if (uiData.phone     !== undefined) payload.phone      = uiData.phone;
    if (uiData.role      !== undefined) payload.role       = uiData.role;
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
    return supabase.from('events').insert(payload).select();
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
    return supabase.from('events').update(payload).eq('id', id);
  },

  async deleteEvent(id) {
    return supabase.from('events').delete().eq('id', id);
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
    if (uiData.receipt_url !== undefined) payload.receipt_url = uiData.receipt_url;
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return supabase.from('expenses').update(payload).eq('id', id).select();
  },

  async updateReceipt(id, url) {
    return supabase.from('expenses').update({ receipt_url: url }).eq('id', id);
  },

  // Upload a receipt file and update the expense row.
  async uploadReceipt(expenseId, file) {
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED  = ['image/jpeg', 'image/png', 'application/pdf'];

    if (file.size > MAX_SIZE) {
      return { publicUrl: null, error: 'File too large. Maximum size is 5MB.' };
    }
    if (!ALLOWED.includes(file.type)) {
      return { publicUrl: null, error: 'Invalid file type. Only JPG, PNG, and PDF are accepted.' };
    }

    const ext  = file.name.split('.').pop();
    const path = `${expenseId}-${Date.now()}.${ext}`;

    // Upload using the anon client (bucket RLS must allow authenticated inserts)
    const { error: upErr } = await supabase.storage
      .from('receipts')
      .upload(path, file, { upsert: true });

    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || path;

    const { error: dbErr } = await supabase
      .from('expenses')
      .update({ receipt_url: publicUrl })
      .eq('id', expenseId);

    if (dbErr) return { publicUrl: null, error: dbErr.message };
    return { publicUrl, error: null };
  },

  // Upload only — returns the URL without saving to DB (used in edit flow).
  async uploadReceiptOnly(expenseId, file) {
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED  = ['image/jpeg', 'image/png', 'application/pdf'];
    if (file.size > MAX_SIZE)       return { publicUrl: null, error: 'File too large. Max 5MB.' };
    if (!ALLOWED.includes(file.type)) return { publicUrl: null, error: 'Only JPG, PNG or PDF accepted.' };

    const ext  = file.name.split('.').pop();
    const path = `${expenseId}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('receipts')
      .upload(path, file, { upsert: true });
    if (upErr) return { publicUrl: null, error: upErr.message };

    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
    return { publicUrl: urlData?.publicUrl || path, error: null };
  },

  async deleteExpense(id) {
    return supabase.from('expenses').delete().eq('id', id);
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
        c.paid     = Number(c.paid_amount);
        c.date     = c.payment_date;
        c.method   = c.payment_method;
      });
    }
    return { data, error };
  },

  async getContributionsByMonth(month, year) {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('month', month)
      .eq('year', year);
    return { data: data || [], error };
  },

  // Fetch active members with role='member' — uses anon client (RLS allows authenticated reads)
  async getActiveMembers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, member_id, role, status')
      .eq('status', 'active')
      .eq('role', 'member')
      .order('full_name', { ascending: true });
    return { data: data || [], error };
  },

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

  async upsertContribution(payload) {
    return supabase
      .from('contributions')
      .upsert(payload, { onConflict: 'member_id,month,year' })
      .select()
      .single();
  },

  async getContributionHistory() {
    const { data, error } = await supabase
      .from('contributions')
      .select('month, year, expected_amount, paid_amount, status, member_id');
    return { data: data || [], error };
  },

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
      paid_amount:     Number(uiData.paid),
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
  },

  // Create initial unpaid contribution rows for a new member from startMonth/startYear
  // through the current month. Uses upsert to avoid duplicates if rows already exist.
  async createInitialContributions(memberUuid, startMonth, startYear, expectedAmount) {
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear  = now.getFullYear();
    const amount   = Number(expectedAmount) || 50;

    const rows = [];
    let m = Number(startMonth);
    let y = Number(startYear);

    // Safety: cap at 24 months to prevent runaway loops
    let safety = 0;
    while ((y < curYear || (y === curYear && m <= curMonth)) && safety < 24) {
      rows.push({
        member_id:       memberUuid,
        month:           m,
        year:            y,
        expected_amount: amount,
        paid_amount:     0,
        status:          'unpaid',
      });
      m++;
      if (m > 12) { m = 1; y++; }
      safety++;
    }

    if (rows.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('contributions')
      .upsert(rows, { onConflict: 'member_id,month,year' });
    return { data, error };
  }
};

export const auditService = {
  // Route audit logs through the Edge Function so the real client IP is captured.
  async logAction(userId, actionType, details) {
    try {
      await callEdgeFunction('log-audit', {
        user_id:     userId,
        action_type: actionType,
        description: typeof details === 'string' ? details : JSON.stringify(details),
      });
    } catch (err) {
      // Fallback: write directly with null IP rather than fake 127.0.0.1
      console.warn('[auditService] Edge function unavailable, writing direct log:', err);
      await supabase.from('audit_logs').insert({
        user_id:     userId,
        action_type: actionType,
        description: typeof details === 'string' ? details : JSON.stringify(details),
        ip_address:  null,
      });
    }
  },

  async getLogs() {
    return supabase
      .from('audit_logs')
      .select(`*, users(full_name, role)`)
      .order('created_at', { ascending: false });
  }
};

// ─── Profile Service ──────────────────────────────────────────────────────────
export const profileService = {
  TABLE: 'users',

  async getAllProfiles() {
    const { data, error } = await supabase
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

  async checkEmailExists(email) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return { exists: !!data, error };
  },

  async getNextMemberId() {
    try {
      // Fetch ALL WEL-* member_ids so we can find the true numeric max.
      // Lexicographic ORDER BY can mis-sort if padding widths differ.
      const { data, error } = await supabase
        .from('users')
        .select('member_id')
        .like('member_id', 'WEL-%');

      if (error) {
        console.error('[getNextMemberId] Query error:', error);
        // Fallback: use timestamp-based ID to guarantee uniqueness
        return `WEL-${String(Date.now()).slice(-6)}`;
      }

      if (!data || data.length === 0) return 'WEL-001';

      // Extract numeric suffixes and find the maximum
      let maxNum = 0;
      data.forEach(row => {
        const match = row.member_id?.match(/^WEL-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });

      return `WEL-${String(maxNum + 1).padStart(3, '0')}`;
    } catch (err) {
      console.error('[getNextMemberId] Unexpected error:', err);
      return `WEL-${String(Date.now()).slice(-6)}`;
    }
  },

  // Delegates to the create-member Edge Function (service role never leaves server).
  // Returns { data, tempPassword } — tempPassword is shown once to the admin.
  async createAuthAndProfile(uiData) {
    const result = await callEdgeFunction('create-member', uiData);
    return result; // { data: profileRow, tempPassword: string }
  },

  async updateProfile(id, uiData) {
    const payload = {};
    if (uiData.name  !== undefined) payload.full_name = uiData.name;
    if (uiData.phone !== undefined) payload.phone     = uiData.phone;
    if (uiData.role  !== undefined) payload.role      = uiData.role;
    const { error } = await supabase.from('users').update(payload).eq('id', id);
    return { error };
  },

  async updateProfileStatus(id, status) {
    const { error } = await supabase.from('users').update({ status }).eq('id', id);
    return { error };
  },

  // Delegates to the reset-password Edge Function (super_admin only).
  // Generates a new temporary password server-side and returns it once.
  async resetPassword(userId) {
    try {
      const result = await callEdgeFunction('reset-password', { userId });
      return { data: result.data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Route audit logs via Edge Function for real IP capture
  async logAuditEntry(userId, actionType, description) {
    await auditService.logAction(userId, actionType, description);
  },
};
