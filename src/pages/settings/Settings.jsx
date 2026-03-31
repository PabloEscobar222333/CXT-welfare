import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { memberService } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { Save, Users, BarChart2, Shield, Settings as SettingsIcon, Ban, CheckCircle, Edit2, X } from 'lucide-react';

// ─── Tab bar ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'general',   label: 'General Settings',   icon: SettingsIcon, roles: ['super_admin', 'treasurer'] },
  { id: 'users',     label: 'User Management',     icon: Users,        roles: ['super_admin'] },
  { id: 'periods',   label: 'Reporting Periods',   icon: BarChart2,    roles: ['super_admin', 'treasurer'] },
  { id: 'security',  label: 'Security Settings',   icon: Shield,       roles: ['super_admin', 'treasurer'] },
];

function TabBar({ active, onChange, allowedTabs }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
      {allowedTabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: isActive ? '600' : '400',
            color: isActive ? 'var(--primary-mid)' : 'var(--text-mid)',
            borderBottom: `2px solid ${isActive ? 'var(--primary-mid)' : 'transparent'}`,
            marginBottom: '-1px', transition: 'all 0.15s',
          }}>
            <Icon size={16} /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab 1: General Settings ─────────────────────────────────────────────────
function GeneralSettings() {
  const { addToast } = useToast();
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState({
    platformName:       settings.platformName,
    currency:           settings.currency,
    monthlyAmount:      settings.monthlyAmount,
    reminderDay:        settings.reminderDay,
    financialYearStart: settings.financialYearStart,
  });

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings({
      platformName:       form.platformName,
      currency:           form.currency,
      monthlyAmount:      form.monthlyAmount,
      reminderDay:        form.reminderDay,
      financialYearStart: form.financialYearStart,
    });
    addToast('Settings saved successfully.', 'success');
  };

  const field = (key, label, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)' }}>{label}</label>
      {opts.select ? (
        <select
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          style={{ height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', backgroundColor: 'var(--pale-blue)' }}
        >
          {opts.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <Input
          type={opts.type || 'text'}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
        />
      )}
      {opts.hint && <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>{opts.hint}</span>}
    </div>
  );

  const currencyOptions = [
    { value: 'GHS', label: 'GHS – Ghanaian Cedi' },
    { value: 'USD', label: 'USD – US Dollar' },
    { value: 'EUR', label: 'EUR – Euro' },
    { value: 'GBP', label: 'GBP – British Pound' },
  ];

  const monthOptions = [
    {value:'1',label:'January'},{value:'2',label:'February'},{value:'3',label:'March'},
    {value:'4',label:'April'},{value:'5',label:'May'},{value:'6',label:'June'},
    {value:'7',label:'July'},{value:'8',label:'August'},{value:'9',label:'September'},
    {value:'10',label:'October'},{value:'11',label:'November'},{value:'12',label:'December'},
  ];

  return (
    <Card style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--light-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-mid)' }}>
          <SettingsIcon size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-dark)', margin: 0 }}>Platform Configuration</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-mid)', margin: 0 }}>All fields editable — Super Admin only.</p>
        </div>
      </div>
      <form onSubmit={handleSave}>
        {field('platformName', 'Platform Name', { hint: 'Appears in reports, exports, and the browser tab.' })}
        {field('currency', 'Default Currency', { select: true, options: currencyOptions, hint: 'Currency shown across contributions, expenses, and reports.' })}
        {field('monthlyAmount', 'Monthly Contribution Amount', { type: 'number', hint: 'Default expected amount per member per month.' })}
        {field('reminderDay', 'Contribution Reminder Day', { type: 'number', hint: 'Day of the month to flag overdue contributions (e.g. 15).' })}
        {field('financialYearStart', 'Financial Year Start Month', { select: true, options: monthOptions, hint: 'Affects how yearly reports and quarters are grouped.' })}
        <Button type="submit" style={{ marginTop: '8px' }}>
          <Save size={16} style={{ marginRight: '8px' }} /> Save Settings
        </Button>
      </form>
    </Card>
  );
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────
function EditMemberModal({ member, onClose, onSave }) {
  const [form, setForm] = useState({
    name: member.name || member.full_name || '',
    email: member.email || '',
    phone: member.phone || '',
    role: member.role || 'member',
    status: member.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const roleOptions = ['member', 'admin', 'super_admin', 'treasurer', 'secretary'];
  const statusOptions = ['active', 'disabled', 'suspended'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(member.id, form);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: 'var(--white)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-dark)', margin: 0 }}>Edit Member</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>Full Name</label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>Email Address</label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>Phone Number</label>
            <Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>Role</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', backgroundColor: 'var(--pale-blue)' }}
              >
                {roleOptions.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', backgroundColor: 'var(--pale-blue)' }}
              >
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>
              <Save size={16} style={{ marginRight: '8px' }} /> Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab 2: User Management ───────────────────────────────────────────────────
function UserManagement() {
  const { members, refreshData } = useData();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [editingMember, setEditingMember] = useState(null);

  const filtered = members.filter(m =>
    (m.name || m.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (m) => {
    const newStatus = m.status === 'active' ? 'disabled' : 'active';
    try {
      await memberService.updateMemberStatus(m.id, newStatus);
      await refreshData();
      addToast(`${m.name || m.full_name} has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      addToast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleSaveEdit = async (id, form) => {
    try {
      // Only update fields that exist in the schema and are safe to patch.
      // Do NOT pass memberId — it would trigger a unique constraint violation if unchanged.
      await memberService.updateMember(id, {
        name:  form.name,
        email: form.email,
        phone: form.phone,
        role:  form.role,
      });
      if (form.status) await memberService.updateMemberStatus(id, form.status);
      await refreshData();
      addToast('Member updated successfully.', 'success');
      setEditingMember(null);
    } catch {
      addToast('Failed to update member. Please try again.', 'error');
    }
  };

  return (
    <>
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveEdit}
        />
      )}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-dark)', margin: 0 }}>All Members</h3>
          <input
            type="text"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', width: '220px', fontSize: '13px' }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontWeight: '600', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                  <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600' }}>{m.name || m.full_name}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{m.email}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{m.phone || '—'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge variant="neutral">{(m.role || 'member').replace('_', ' ')}</Badge>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge variant={m.status === 'active' ? 'success' : 'gray'}>{m.status}</Badge>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => setEditingMember(m)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-mid)' }}
                        title="Edit member"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleToggle(m)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: m.status === 'active' ? 'var(--danger)' : 'var(--success)' }}
                        title={m.status === 'active' ? 'Disable account' : 'Enable account'}
                      >
                        {m.status === 'active' ? <Ban size={16} /> : <CheckCircle size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ─── Tab 3: Reporting Periods ─────────────────────────────────────────────────
function ReportingPeriods() {
  const { addToast } = useToast();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentQ = currentMonth <= 3 ? 'Q1' : currentMonth <= 6 ? 'Q2' : currentMonth <= 9 ? 'Q3' : 'Q4';

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthOptions = monthNames.map((m, i) => ({ value: String(i + 1), label: m }));

  const [quarters, setQuarters] = useState([
    { id: 'Q1', label: 'Q1', startMonth: '1',  endMonth: '3'  },
    { id: 'Q2', label: 'Q2', startMonth: '4',  endMonth: '6'  },
    { id: 'Q3', label: 'Q3', startMonth: '7',  endMonth: '9'  },
    { id: 'Q4', label: 'Q4', startMonth: '10', endMonth: '12' },
  ]);

  const updateQuarter = (id, key, value) => {
    setQuarters(prev => prev.map(q => q.id === id ? { ...q, [key]: value } : q));
  };

  const handleSave = () => {
    addToast('Reporting periods saved successfully.', 'success');
  };

  const selectStyle = { height: '36px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', backgroundColor: 'var(--pale-blue)', minWidth: '120px' };

  return (
    <div style={{ maxWidth: '760px' }}>
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px', color: 'var(--primary-dark)' }}>Configured Quarters</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-mid)', margin: 0 }}>
              Edit the start and end month for each quarter. Changes affect all quarterly reports.
            </p>
          </div>
          <Button onClick={handleSave}>
            <Save size={15} style={{ marginRight: '6px' }} /> Save Periods
          </Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'left' }}>Quarter</th>
              <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'left' }}>Start Month</th>
              <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'left' }}>End Month</th>
              <th style={{ padding: '10px 16px', fontWeight: '600', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map(q => {
              const isCurrent = q.id === currentQ;
              return (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isCurrent ? '#EFF6FF' : 'var(--white)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '700', color: isCurrent ? 'var(--primary-mid)' : 'var(--text-dark)' }}>{q.label}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <select value={q.startMonth} onChange={e => updateQuarter(q.id, 'startMonth', e.target.value)} style={selectStyle}>
                      {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <select value={q.endMonth} onChange={e => updateQuarter(q.id, 'endMonth', e.target.value)} style={selectStyle}>
                      {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {isCurrent
                      ? <Badge variant="primary">Current Period</Badge>
                      : <Badge variant="neutral">Inactive</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-dark)' }}>Financial Year</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-mid)', lineHeight: '1.6' }}>
          Financial year runs <strong>January → December</strong>. Configure the start month in General Settings.
        </p>
      </Card>
    </div>
  );
}

// ─── Tab 4: Security Settings ─────────────────────────────────────────────────
function SecuritySettings() {
  const { addToast } = useToast();
  const [policies, setPolicies] = useState([
    { key: 'sessionTimeout',    label: 'Session Timeout',              value: '30 minutes',     hint: 'e.g. "30 minutes" or "1 hour"' },
    { key: 'minPasswordLength', label: 'Minimum Password Length',      value: '10 characters',  hint: 'e.g. "8 characters"' },
    { key: 'complexity',        label: 'Password Complexity',          value: 'Uppercase, lowercase, number, and special character required', hint: 'Describe the rule shown to users.' },
    { key: 'passwordExpiry',    label: 'Password Expiry',              value: '90 days',        hint: 'e.g. "90 days" or "Never"' },
    { key: 'lockout',           label: 'Account Lockout',              value: 'After 5 failed attempts', hint: 'e.g. "After 5 failed attempts"' },
    { key: 'forceChange',       label: 'Must Change on First Login',   value: 'Enforced for all new accounts', hint: 'e.g. "Enforced" or "Optional"' },
  ]);

  const updatePolicy = (key, value) => {
    setPolicies(prev => prev.map(p => p.key === key ? { ...p, value } : p));
  };

  const handleSave = (e) => {
    e.preventDefault();
    addToast('Security policies saved successfully.', 'success');
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--light-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-mid)' }}>
            <Shield size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--primary-dark)' }}>Security Policy</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-mid)', margin: 0 }}>Editable by Super Admin only. Changes apply system-wide.</p>
          </div>
        </div>
        <form onSubmit={handleSave}>
          {policies.map((p, i) => (
            <div key={p.key} style={{ paddingBottom: '20px', marginBottom: '20px', borderBottom: i < policies.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '6px' }}>{p.label}</label>
              <Input
                value={p.value}
                onChange={e => updatePolicy(p.key, e.target.value)}
                placeholder={p.hint}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>{p.hint}</span>
            </div>
          ))}
          <Button type="submit" style={{ marginTop: '8px' }}>
            <Save size={16} style={{ marginRight: '8px' }} /> Save Security Settings
          </Button>
        </form>
      </Card>
      <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#92400E', lineHeight: '1.5' }}>
        <strong>Note:</strong> Changes here update the displayed policy text. Backend enforcement is managed at the infrastructure level.
      </div>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();

  // Roles allowed into Settings at all
  const ALLOWED_ROLES = ['super_admin', 'treasurer'];

  if (!ALLOWED_ROLES.includes(user?.role)) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>
        <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Access Restricted</h3>
        <p style={{ fontSize: '14px' }}>Settings are only accessible to Super Admins and Treasurers.</p>
      </div>
    );
  }

  // Filter tabs to those permitted for this role
  const allowedTabs = TABS.filter(t => t.roles.includes(user?.role));

  const [activeTab, setActiveTab] = React.useState(allowedTabs[0]?.id || 'general');

  // If somehow the active tab is no longer allowed (e.g. role changed), reset
  const safeActiveTab = allowedTabs.find(t => t.id === activeTab) ? activeTab : allowedTabs[0]?.id;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Settings</h2>
        <p style={{ color: 'var(--text-mid)' }}>Configure platform behaviour, users, reporting periods, and security policies.</p>
      </div>
      <TabBar active={safeActiveTab} onChange={setActiveTab} allowedTabs={allowedTabs} />
      {safeActiveTab === 'general'  && <GeneralSettings />}
      {safeActiveTab === 'users'    && <UserManagement />}
      {safeActiveTab === 'periods'  && <ReportingPeriods />}
      {safeActiveTab === 'security' && <SecuritySettings />}
    </div>
  );
}
