import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { contributionService, profileService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Download, Ban, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

// ─── Access control ───────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['super_admin', 'treasurer', 'auditor', 'member'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const _NOW = new Date();
const CURRENT_YEAR = _NOW.getFullYear();
const CURRENT_MONTH = _NOW.getMonth() + 1;

function fmtCurrency(n, currency = 'GHS') {
  return currency + ' ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtGHS(n) {
  return 'GHS ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Audit log helper ─────────────────────────────────────────────────────────
async function logAudit(action, table, rowId, details, userId) {
  try {
    const { supabase } = await import('../../services/api');
    await supabase.from('audit_logs').insert({
      user_id:     userId,
      action_type: action,
      description: JSON.stringify({ table, row_id: rowId, ...details }),
      ip_address:  '127.0.0.1',
    });
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}

// ─── Select style ─────────────────────────────────────────────────────────────
const selStyle = {
  height: '40px', padding: '0 12px', borderRadius: '8px',
  border: '1px solid var(--border-color)', outline: 'none',
  fontSize: '14px', backgroundColor: 'var(--white)',
};

// ─── Loading spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '48px', justifyContent: 'center', color: 'var(--text-mid)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '14px' }}>Loading…</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────
function SummaryBar({ rows, currency }) {
  const totalExpected  = rows.reduce((s, r) => s + Number(r.expected_amount || 0), 0);
  const totalCollected = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const outstanding    = totalExpected - totalCollected;
  const membersPaid    = rows.filter(r => r.status === 'paid').length;
  const pct            = totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0;
  const fmt            = (n) => fmtCurrency(n, currency);

  return (
    <Card style={{ padding: '20px 24px', marginBottom: '1.5rem', backgroundColor: 'var(--white)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '16px' }}>
        {[
          { label: 'Total Expected',  value: fmt(totalExpected),  color: 'var(--primary-dark)' },
          { label: 'Total Collected', value: fmt(totalCollected), color: '#16A34A' },
          { label: 'Outstanding',     value: fmt(outstanding),    color: '#D97706' },
          { label: 'Members Paid',    value: `${membersPaid} / ${rows.length}`, color: 'var(--primary-dark)' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '12px', color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#DBEAFE', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#1A56DB', transition: 'width 0.4s ease', borderRadius: '4px' }} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '6px' }}>{pct.toFixed(1)}% collected</div>
    </Card>
  );
}

// ─── Inline Edit Form ─────────────────────────────────────────────────────────
function InlineEditForm({ row, onSave, onCancel, saving }) {
  const [amount, setAmount]   = useState(String(row.expected_amount || ''));
  const [date,   setDate]     = useState(row.payment_date || todayStr());
  const [method, setMethod]   = useState(row.payment_method || 'Cash');

  return (
    <tr style={{ backgroundColor: '#F0F7FF', borderBottom: '1px solid var(--border-color)' }}>
      <td colSpan={8} style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '4px' }}>Amount Paid (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ height: '40px', width: '140px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '4px' }}>Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '4px' }}>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={selStyle}>
              <option value="Cash">Cash</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingBottom: '0' }}>
            <Button onClick={() => onSave({ amount: Number(amount), date, method })} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Tab 1 — Monthly Entry ────────────────────────────────────────────────────
function MonthlyEntry({ currentUser }) {
  const isMember = currentUser?.role === 'member';
  const isAuditor = currentUser?.role === 'auditor';
  const isReadOnly = isMember || isAuditor;
  const { addToast } = useToast();
  const { settings } = useSettings();

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear,  setSelectedYear]  = useState(CURRENT_YEAR);
  const [loaded,        setLoaded]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [loadError,     setLoadError]     = useState(false);
  const [rows,          setRows]          = useState([]);
  const [editingId,     setEditingId]     = useState(null);
  const [savingId,      setSavingId]      = useState(null);

  // Derive currency and default amount from platform settings (used inside callbacks too)
  const currency    = settings.currency    || 'GHS';
  const reminderDay = settings.reminderDay || '15';

  // Keep document title in sync with the platform name setting
  React.useEffect(() => {
    if (settings.platformName) document.title = settings.platformName;
  }, [settings.platformName]);

  const yearOptions = [];
  for (let y = 2026; y <= 2050; y++) yearOptions.push(y);

  const handleLoadMonth = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setEditingId(null);

    try {
      // 1) Fetch active members (role=member)
      const { data: members, error: membErr } = await contributionService.getActiveMembers();
      if (membErr) throw membErr;

      if (!members || members.length === 0) {
        setRows([]);
        setLoaded(true);
        setLoading(false);
        return;
      }

      // 2) Default expected amount = platform setting (contribution_settings table not in schema)
      const defaultExpected = Number(settings.monthlyAmount) || 50;

      // 3) Fetch existing contributions for this month/year
      const { data: existing, error: exErr } = await contributionService.getContributionsByMonth(selectedMonth, selectedYear);
      if (exErr) throw exErr;

      const existingMap = {};
      (existing || []).forEach(c => { existingMap[c.member_id] = c; });

      // 4a) Insert brand-new rows for members who have no record yet
      const inserts = members
        .filter(m => !existingMap[m.id])
        .map(m => ({
          member_id:       m.id,
          month:           selectedMonth,
          year:            selectedYear,
          expected_amount: defaultExpected,
          paid_amount:     0,
          status:          'unpaid',
        }));

      if (inserts.length > 0) {
        const { supabaseAdmin } = await import('../../services/api');
        const { error: insErr } = await supabaseAdmin
          .from('contributions')
          .upsert(inserts, { onConflict: 'member_id,month,year' });
        if (insErr) console.warn('Insert new rows error:', insErr);
      }

      // 4b) Update expected_amount for unpaid/partial rows that differ from the platform setting.
      //     Uses supabaseAdmin to bypass RLS. Paid rows are left unchanged.
      const toUpdate = (existing || []).filter(
        c => (c.status === 'unpaid' || c.status === 'partial') &&
             Number(c.expected_amount) !== defaultExpected
      );
      if (toUpdate.length > 0) {
        const { supabaseAdmin } = await import('../../services/api');
        await Promise.all(
          toUpdate.map(c =>
            supabaseAdmin
              .from('contributions')
              .update({ expected_amount: defaultExpected, updated_at: new Date().toISOString() })
              .eq('member_id', c.member_id)
              .eq('month', selectedMonth)
              .eq('year', selectedYear)
          )
        );
      }

      // 5) Re-fetch all contributions for this month
      const { data: final, error: finalErr } = await contributionService.getContributionsByMonth(selectedMonth, selectedYear);
      if (finalErr) throw finalErr;

      // 6) Merge with member info
      const memberMap = {};
      members.forEach(m => { memberMap[m.id] = m; });

      const merged = (final || []).map(c => ({
        ...c,
        memberInfo: memberMap[c.member_id] || null,
      })).sort((a, b) => {
        const na = a.memberInfo?.full_name || '';
        const nb = b.memberInfo?.full_name || '';
        return na.localeCompare(nb);
      });

      setRows(merged);
      setLoaded(true);
    } catch (err) {
      console.error('Load month error:', err);
      setLoadError(true);
    }
    setLoading(false);
  }, [selectedMonth, selectedYear, currentUser, settings]);

  const handleSaveRow = async (row, formData) => {
    setSavingId(row.member_id);
    try {
      const paidAmount = Number(formData.amount) || 0;
      let newStatus = 'unpaid';
      if (paidAmount >= Number(row.expected_amount)) newStatus = 'paid';
      else if (paidAmount > 0) newStatus = 'partial';

      // Use paid_amount to match actual DB schema column name
      const payload = {
        member_id:       row.member_id,
        month:           selectedMonth,
        year:            selectedYear,
        expected_amount: Number(row.expected_amount),
        paid_amount:     paidAmount,
        payment_date:    formData.date || null,
        payment_method:  formData.method || null,
        status:          newStatus,
        updated_at:      new Date().toISOString(),
      };

      const { data: saved, error } = await import('../../services/api').then(api =>
        api.supabaseAdmin.from('contributions').upsert(payload, { onConflict: 'member_id,month,year' }).select().single()
      );
      if (error) throw error;

      // Update local state — keep paid_amount consistent
      setRows(prev => prev.map(r => r.member_id === row.member_id ? { ...r, ...payload, id: saved?.id || r.id } : r));
      setEditingId(null);

      // Audit log
      const memberName = row.memberInfo?.full_name || row.member_id;
      await logAudit('Contribution Updated', 'contribution', saved?.id || row.id, {
        member_name:  memberName,
        month:        selectedMonth,
        year:         selectedYear,
        paid_amount:  paidAmount,
        status:       newStatus,
        recorded_by:  currentUser?.full_name || currentUser?.email || currentUser?.id,
      }, currentUser?.id);

      addToast('Contribution saved successfully.', 'success');
    } catch (err) {
      console.error('Save row error:', err);
      addToast('Failed to save. Please try again.', 'error');
    }
    setSavingId(null);
  };

  const handleExportCSV = () => {
    if (!rows || rows.length === 0) return;

    const monthName = typeof selectedMonth === 'number'
      ? MONTH_NAMES[selectedMonth - 1]
      : selectedMonth;

    const headers = [
      'Member ID',
      'Member Name',
      'Expected Amount',
      'Amount Paid',
      'Outstanding',
      'Payment Date',
      'Payment Method',
      'Status',
    ];

    const csvData = rows.map(row => [
      row.memberInfo?.member_id || '',
      row.memberInfo?.full_name || '',
      parseFloat(row.expected_amount || 0).toFixed(2),
      parseFloat(row.paid_amount || 0).toFixed(2),
      parseFloat(Math.max(0, (row.expected_amount || 0) - (row.paid_amount || 0))).toFixed(2),
      row.payment_date || '',
      row.payment_method || '',
      row.status || 'unpaid',
    ]);

    const escapeCell = (cell) => {
      const value = String(cell ?? '');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [headers, ...csvData]
      .map(row => row.map(escapeCell).join(','))
      .join('\r\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Contributions_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const noMembers = loaded && rows.length === 0;

  return (
    <>
      {/* Controls */}
      <Card style={{ padding: '16px 24px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={selStyle}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={selStyle}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={handleLoadMonth} loading={loading}>Load Month</Button>
          <span style={{
            fontSize: '12px', color: 'var(--text-mid)',
            backgroundColor: 'var(--light-blue)', borderRadius: '6px',
            padding: '4px 10px', fontWeight: '500',
          }}>
            Reminder: day {reminderDay} · Default: {currency} {Number(settings.monthlyAmount || 50).toFixed(2)}
          </span>
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            disabled={!loaded || rows.length === 0 || isMember}
            style={{ marginLeft: 'auto' }}
          >
            <Download size={15} style={{ marginRight: '6px' }} /> Export CSV
          </Button>
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <Card style={{ marginBottom: '1.5rem' }}><Spinner /></Card>
      )}

      {/* Error */}
      {!loading && loadError && (
        <Card style={{ padding: '32px', textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '14px' }}>Could not load data. Please try again.</p>
          <Button variant="secondary" onClick={handleLoadMonth}>Retry</Button>
        </Card>
      )}

      {/* No members message */}
      {!loading && !loadError && noMembers && (
        <Card style={{ padding: '48px', textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-mid)', fontSize: '14px' }}>No active members found. Please add members first.</p>
        </Card>
      )}

      {/* Summary + Table */}
      {!loading && !loadError && loaded && rows.length > 0 && (
        <>
          <SummaryBar rows={rows} currency={currency} />

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                    {['Member ID','Member Name',`Expected (${currency})`,'Amount Paid','Payment Date','Payment Method','Status',...(isReadOnly ? [] : ['Actions'])].map(h => (
                      <th key={h} style={{ padding: '13px 20px', fontWeight: '600', whiteSpace: 'nowrap', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isEditing = editingId === row.member_id;
                    const isSaving  = savingId  === row.member_id;
                    const outstanding = Math.max(0, Number(row.expected_amount) - Number(row.paid_amount));
                    const rowBg = i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)';

                    return (
                      <React.Fragment key={row.member_id}>
                        <tr style={{ borderBottom: isEditing ? 'none' : '1px solid var(--border-color)', backgroundColor: rowBg }}>
                          {/* Member ID */}
                          <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: 'var(--primary-mid)' }}>
                            {row.memberInfo?.member_id || '—'}
                          </td>
                          {/* Member Name */}
                          <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>
                            {row.memberInfo?.full_name || '—'}
                          </td>
                          {/* Expected */}
                          <td style={{ padding: '14px 20px', fontSize: '14px' }}>
                            {Number(row.expected_amount).toFixed(2)}
                          </td>
                          {/* Amount Paid */}
                          <td style={{ padding: '14px 20px', fontSize: '14px' }}>
                            {Number(row.paid_amount) > 0 ? Number(row.paid_amount).toFixed(2) : '—'}
                            {row.status === 'partial' && (
                              <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                                Outstanding: GHS {outstanding.toFixed(2)}
                              </div>
                            )}
                          </td>
                          {/* Payment Date */}
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>
                            {fmtDate(row.payment_date)}
                          </td>
                          {/* Payment Method */}
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)', textTransform: 'capitalize' }}>
                            {row.payment_method ? row.payment_method.replace(/_/g, ' ') : '—'}
                          </td>
                          {/* Status Badge */}
                          <td style={{ padding: '14px 20px' }}>
                            <Badge variant={row.status === 'paid' ? 'success' : row.status === 'partial' ? 'warning' : 'danger'}>
                              {row.status || 'unpaid'}
                            </Badge>
                          </td>
                          {/* Actions — hidden for members and auditors */}
                          {!isReadOnly && (
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            {row.status === 'paid'
                              ? (
                                <Button variant="secondary" style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                                  onClick={() => setEditingId(isEditing ? null : row.member_id)}>
                                  Edit
                                </Button>
                              )
                              : (
                                <Button variant="secondary" style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
                                  onClick={() => setEditingId(isEditing ? null : row.member_id)}>
                                  Mark as Paid
                                </Button>
                              )
                            }
                          </td>
                          )}
                        </tr>

                        {/* Inline form */}
                        {isEditing && (
                          <InlineEditForm
                            row={row}
                            saving={isSaving}
                            onSave={(formData) => handleSaveRow(row, formData)}
                            onCancel={() => setEditingId(null)}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ─── History expanded member rows ─────────────────────────────────────────────
function HistoryMonthDetail({ month, year }) {
  const [rows, setRows] = useState(null);
  const [err,  setErr]  = useState(false);

  React.useEffect(() => {
    contributionService.getContributionsByMonthYear(month, year).then(({ data, error }) => {
      if (error) { setErr(true); return; }
      setRows(data || []);
    });
  }, [month, year]);

  if (err) return <td colSpan={7} style={{ padding: '16px 24px', color: 'var(--danger)', fontSize: '13px' }}>Could not load detail.</td>;
  if (!rows) return <td colSpan={7} style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-mid)' }}>Loading…</td>;

  return (
    <td colSpan={7} style={{ padding: 0 }}>
      <div style={{ backgroundColor: '#F8FAFF', borderTop: '1px solid var(--border-color)', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#EFF6FF', color: 'var(--primary-dark)', fontSize: '11px', textTransform: 'uppercase' }}>
              {['Member Name','Expected','Amount Paid','Outstanding','Payment Date','Method','Status'].map(h => (
                <th key={h} style={{ padding: '10px 24px', fontWeight: '600', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '16px 24px', color: 'var(--text-mid)' }}>No records.</td></tr>
            )}
            {rows.map((r, i) => {
              const outstanding = Math.max(0, Number(r.expected_amount) - Number(r.paid_amount));
              // Join data may come back as users!member_id or users depending on PostgREST version
              const memberName = r.users?.full_name || r.member_id;
              return (
                <tr key={r.id || i} style={{ borderTop: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? '#F8FAFF' : 'var(--white)' }}>
                  <td style={{ padding: '12px 24px', fontWeight: '600' }}>{memberName}</td>
                  <td style={{ padding: '12px 24px' }}>{Number(r.expected_amount).toFixed(2)}</td>
                  <td style={{ padding: '12px 24px' }}>{Number(r.paid_amount).toFixed(2)}</td>
                  <td style={{ padding: '12px 24px', color: outstanding > 0 ? '#D97706' : 'var(--text-mid)' }}>{outstanding.toFixed(2)}</td>
                  <td style={{ padding: '12px 24px', color: 'var(--text-mid)' }}>{fmtDate(r.payment_date)}</td>
                  <td style={{ padding: '12px 24px', color: 'var(--text-mid)' }}>{r.payment_method || '—'}</td>
                  <td style={{ padding: '12px 24px' }}>
                    <Badge variant={r.status === 'paid' ? 'success' : r.status === 'partial' ? 'warning' : 'danger'}>{r.status || 'unpaid'}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </td>
  );
}

// ─── Tab 2 — Contribution History ────────────────────────────────────────────
function ContributionHistory() {
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadErr,    setLoadErr]    = useState(false);
  const [expanded,   setExpanded]   = useState(null); // 'month-year' key

  React.useEffect(() => {
    contributionService.getContributionHistory().then(({ data, error }) => {
      if (error) { setLoadErr(true); setLoading(false); return; }

      // Group by month+year
      const map = {};
      (data || []).forEach(c => {
        const key = `${c.month}-${c.year}`;
        if (!map[key]) map[key] = { month: c.month, year: c.year, expected: 0, collected: 0, paid: 0, total: 0 };
        map[key].expected  += Number(c.expected_amount || 0);
        map[key].collected += Number(c.paid_amount || 0);  // DB column is paid_amount
        map[key].total     += 1;
        if (c.status === 'paid') map[key].paid += 1;
      });

      const sorted = Object.values(map).sort((a, b) => b.year - a.year || b.month - a.month);
      setRows(sorted);
      setLoading(false);
    });
  }, []);

  const toggleExpand = (key) => setExpanded(prev => prev === key ? null : key);

  if (loading) return <Card><Spinner /></Card>;
  if (loadErr) return <Card style={{ padding: '32px', textAlign: 'center' }}><p style={{ color: 'var(--danger)', fontSize: '14px' }}>Could not load history.</p></Card>;
  if (rows.length === 0) return <Card style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: 'var(--text-mid)', fontSize: '14px' }}>No contribution history found.</p></Card>;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
              {['','Month','Year','Total Expected','Total Collected','Members Paid','% Collected','Status'].map((h, idx) => (
                <th key={idx} style={{ padding: '13px 20px', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const key = `${row.month}-${row.year}`;
              const pct = row.expected > 0 ? (row.collected / row.expected) * 100 : 0;
              const isExpanded = expanded === key;
              let overallStatus = 'None';
              let statusVariant = 'danger';
              if (row.paid === row.total && row.total > 0) { overallStatus = 'Complete'; statusVariant = 'success'; }
              else if (row.collected > 0) { overallStatus = 'Partial'; statusVariant = 'warning'; }

              return (
                <React.Fragment key={key}>
                  <tr
                    onClick={() => toggleExpand(key)}
                    style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 12px 14px 20px', color: 'var(--text-light)' }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>{MONTH_NAMES[row.month - 1]}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px' }}>{row.year}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px' }}>{fmtGHS(row.expected)}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px' }}>{fmtGHS(row.collected)}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px' }}>{row.paid} / {row.total}</td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600', color: pct >= 100 ? '#16A34A' : '#D97706' }}>
                      {pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge variant={statusVariant}>{overallStatus}</Badge>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <HistoryMonthDetail month={row.month} year={row.year} />
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Main Contributions Component ─────────────────────────────────────────────
export function Contributions() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [activeTab, setActiveTab] = useState('monthly');

  // Access control — members are allowed through
  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', color: 'var(--text-mid)' }}>
        <Ban size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-dark)' }}>Access Denied</h3>
        <p style={{ fontSize: '14px', maxWidth: '360px' }}>
          This page is restricted to Super Admins and Treasurers only.
        </p>
        <Button variant="secondary" style={{ marginTop: '24px' }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        background: 'none', border: 'none', padding: '0.75rem 1rem', fontSize: '14px',
        fontWeight: '600', cursor: 'pointer', outline: 'none',
        color:       activeTab === id ? 'var(--primary-mid)' : 'var(--text-mid)',
        borderBottom: activeTab === id ? '2px solid var(--primary-mid)' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Member Contributions</h2>
        <p style={{ color: 'var(--text-mid)' }}>Record and track monthly welfare payments.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        {tabBtn('monthly', 'Monthly Entry')}
      </div>

      {activeTab === 'monthly' && <MonthlyEntry currentUser={user} />}
    </div>
  );
}
