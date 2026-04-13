import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Edit2, Ban, CheckCircle, Key, Search, X, UserPlus, Copy } from 'lucide-react';

// ─── Allowed roles for this page ─────────────────────────────────────────────
const ALLOWED_ROLES = ['super_admin', 'treasurer'];

// ─── Role badge colours ───────────────────────────────────────────────────────
const ROLE_BADGE = {
  super_admin: { bg: '#1E3A5F', color: '#fff' },
  treasurer:   { bg: '#1D4ED8', color: '#fff' },
  chairman:    { bg: '#3730A3', color: '#fff' },
  secretary:   { bg: '#0F766E', color: '#fff' },
  auditor:     { bg: '#6D28D9', color: '#fff' },
  member:      { bg: '#E2E8F0', color: '#64748B' },
};

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.member;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: '600', textTransform: 'capitalize',
      backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {(role || 'member').replace(/_/g, ' ')}
    </span>
  );
}

// ─── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer, maxWidth = '520px' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--white)', borderRadius: '16px',
        width: '100%', maxWidth, maxHeight: '90vh', display: 'flex',
        flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--primary-dark)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--pale-blue)', display: 'flex',
            justifyContent: 'flex-end', gap: '12px', flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field wrapper helper ─────────────────────────────────────────────────────
function Field({ label, error, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>{hint}</span>}
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  const cell = (w = '80%') => (
    <td style={{ padding: '16px 20px' }}>
      <div style={{ height: '14px', borderRadius: '4px', backgroundColor: '#E2E8F0', width: w, animation: 'pulse 1.5s ease-in-out infinite' }} />
    </td>
  );
  return (
    <tr>
      {cell('60%')}{cell('70%')}{cell('50%')}{cell('80%')}{cell('55%')}{cell('40%')}{cell('60%')}
      <td style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {[1,2,3].map(i => <div key={i} style={{ width:'28px', height:'28px', borderRadius:'6px', backgroundColor:'#E2E8F0', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      </td>
    </tr>
  );
}

// ─── Temporary Password Modal ─────────────────────────────────────────────────
// Reusable for both add-member and reset-password flows.
function TempPasswordModal({ password, userName, onDone }) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      addToast('Temporary password copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy. Please select and copy manually.', 'error');
    }
  };

  return (
    <Modal
      title="Account Created Successfully"
      onClose={onDone}
      maxWidth="500px"
      footer={
        <Button onClick={onDone} style={{ minWidth: '100px' }}>Done</Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Success banner */}
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>✅</span>
          <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: '1.6' }}>
            {userName
              ? <>Account for <strong>{userName}</strong> has been created successfully.</>
              : 'Account created successfully.'}
          </p>
        </div>

        {/* Instruction */}
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-mid)', lineHeight: '1.6' }}>
          Share this temporary password with the user. <strong>It will not be shown again.</strong>
        </p>

        {/* Password display */}
        <div style={{ position: 'relative' }}>
          <div style={{
            backgroundColor: '#1E293B', color: '#F1F5F9', fontFamily: "'Courier New', Courier, monospace",
            fontSize: '18px', fontWeight: '700', letterSpacing: '2px', padding: '16px 50px 16px 20px',
            borderRadius: '8px', textAlign: 'center', userSelect: 'all', wordBreak: 'break-all',
          }}>
            {password}
          </div>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#86EFAC' : '#94A3B8',
              padding: '6px', borderRadius: '4px', lineHeight: 0,
              transition: 'color 0.2s',
            }}
          >
            <Copy size={20} />
          </button>
        </div>

        {/* Copy button (large) */}
        <Button variant="secondary" onClick={handleCopy} style={{ width: '100%' }}>
          <Copy size={16} style={{ marginRight: '8px' }} />
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </Button>

        {/* Warning */}
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#92400E', lineHeight: '1.6' }}>
            The user will be required to set a new permanent password on their next login.
            The temporary password cannot be retrieved after dismissing this dialog.
            The system does not send any email — distributing this password is your responsibility.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add / Edit Member Modal ──────────────────────────────────────────────────
function MemberFormModal({ mode, member, onClose, onSave, currentUserId, isSuperAdmin, submitting }) {
  const [form, setForm] = useState({
    name:       member?.full_name || member?.name || '',
    memberId:   member?.member_id || member?.memberId || '',
    email:      member?.email || '',
    phone:      member?.phone || '',
    role:       member?.role || 'member',
    department: member?.department || '',
  });
  const [errors, setErrors] = useState({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleChanged, setRoleChanged] = useState(false);
  const [rolePromptVisible, setRolePromptVisible] = useState(false);
  const originalRole = member?.role || 'member';

  // Auto-suggest next member ID when in add mode
  useEffect(() => {
    if (mode === 'add' && !form.memberId) {
      profileService.getNextMemberId().then(id => setForm(f => ({ ...f, memberId: id })));
    }
  }, []);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
    if (key === 'role' && mode === 'edit') {
      const changed = val !== originalRole;
      setRoleChanged(changed);
      if (!changed) setRolePromptVisible(false);
    }
  };

  const handleEmailBlur = async () => {
    if (mode !== 'add' || !form.email) return;
    setEmailChecking(true);
    const { exists } = await profileService.checkEmailExists(form.email);
    if (exists) setErrors(e => ({ ...e, email: 'This email address is already registered.' }));
    setEmailChecking(false);
  };

  const validate = () => {
    const err = {};
    if (!form.name.trim())     err.name     = 'Full name is required.';
    if (!form.memberId.trim()) err.memberId  = 'Member ID is required.';
    if (!form.email.trim())    err.email     = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = 'Enter a valid email address.';
    if (!form.phone.trim())    err.phone     = 'Phone number is required.';
    if (!form.role)            err.role      = 'Role is required.';
    return err;
  };

  const handleSave = () => {
    const err = validate();
    if (err.email === undefined && errors.email) err.email = errors.email; // carry forward dup check error
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    if (mode === 'edit' && roleChanged && !rolePromptVisible) {
      setRolePromptVisible(true);
      return;
    }
    onSave(form);
  };

  const cancelRoleChange = () => {
    setForm(f => ({ ...f, role: originalRole }));
    setRoleChanged(false);
    setRolePromptVisible(false);
  };

  const isSaveDisabled = saving || submitting || emailChecking || (errors.email ? true : false);

  const selectStyle = {
    height: '40px', border: `1px solid var(--border-color)`, borderRadius: '8px',
    padding: '0 12px', fontSize: '14px', outline: 'none',
    backgroundColor: 'var(--pale-blue)', width: '100%',
  };

  return (
    <Modal
      title={mode === 'add' ? 'Add New Member' : 'Edit Member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting} style={{ minWidth: '90px' }}>Cancel</Button>
          <Button onClick={handleSave} loading={saving || submitting} disabled={isSaveDisabled} style={{ minWidth: '140px' }}>
            {mode === 'add' ? 'Create Account' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <Field label="Full Name *" error={errors.name}>
        <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Kwame Mensah" />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Member ID *" error={errors.memberId}>
          {mode === 'edit'
            ? <div style={{ height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: '14px', backgroundColor: '#F8FAFC', color: 'var(--text-light)' }}>{form.memberId}</div>
            : <Input value={form.memberId} onChange={e => setField('memberId', e.target.value)} placeholder="WEL-001" />}
        </Field>
        <Field label="Role *" error={errors.role}>
          <select value={form.role} onChange={e => setField('role', e.target.value)} style={selectStyle}>
            <option value="member">Member</option>
            <option value="auditor">Auditor</option>
            <option value="secretary">Secretary</option>
            <option value="chairman">Chairman</option>
            <option value="treasurer">Treasurer</option>
            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
          </select>
        </Field>
      </div>

      <Field label="Email Address *" error={errors.email}
        hint={mode === 'edit' ? 'Email cannot be changed. Contact system admin.' : emailChecking ? 'Checking…' : undefined}>
        {mode === 'edit'
          ? <div style={{ height: '40px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: '14px', backgroundColor: '#F8FAFC', color: 'var(--text-light)' }}>{form.email}</div>
          : <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} onBlur={handleEmailBlur} placeholder="example@company.com" />}
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Phone Number *" error={errors.phone}>
          <Input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+233 20 000 0000" />
        </Field>
        <Field label="Department / Group" error={errors.department}>
          <Input value={form.department} onChange={e => setField('department', e.target.value)} placeholder="e.g. Engineering" />
        </Field>
      </div>

      {rolePromptVisible && (
        <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: '#92400E', margin: '0 0 12px 0', lineHeight: '1.5' }}>
            <strong>Confirm role change:</strong> Changing this user's role will take effect on their next login.
            Their existing activity will remain recorded under their previous role.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={() => { setRolePromptVisible(false); onSave(form); }} style={{ height: '32px', fontSize: '13px', padding: '0 12px' }}>
              Yes, Change Role
            </Button>
            <Button variant="secondary" onClick={cancelRoleChange} style={{ height: '32px', fontSize: '13px', padding: '0 12px' }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Confirm Action Modal (Disable / Enable / Reset PW) ──────────────────────
function ConfirmModal({ title, body, confirmLabel, confirmVariant = 'primary', onClose, onConfirm, loading }) {
  return (
    <Modal title={title} onClose={onClose} maxWidth="480px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} style={{ minWidth: '90px' }}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} style={{ minWidth: '140px' }}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ fontSize: '14px', color: 'var(--text-mid)', lineHeight: '1.6', margin: 0 }}>{body}</p>
    </Modal>
  );
}

// ─── Main Members Component ───────────────────────────────────────────────────
export function Members() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const { addToast } = useToast();

  // ── Access guard ────────────────────────────────────────────────────────────
  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', color: 'var(--text-mid)' }}>
        <Ban size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary-dark)' }}>Access Denied</h3>
        <p style={{ fontSize: '14px', maxWidth: '360px' }}>
          This page is restricted to Super Admins and Treasurers only. Contact your administrator if you believe this is a mistake.
        </p>
        <Button variant="secondary" style={{ marginTop: '24px' }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  // ── Data state ──────────────────────────────────────────────────────────────
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modal,        setModal]        = useState(null);
  const [active,       setActive]       = useState(null);
  const [acting,       setActing]       = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempUserName, setTempUserName] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await profileService.getAllProfiles();
    if (error) {
      console.error('Members fetch error:', error);
      addToast('Could not load members. Please refresh the page.', 'error');
    } else {
      setMembers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Filtered view ────────────────────────────────────────────────────────────
  const displayed = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (m.full_name || '').toLowerCase().includes(q)
      || (m.member_id || '').toLowerCase().includes(q);
    const matchRole   = roleFilter   === 'All' || m.role   === roleFilter.toLowerCase();
    const matchStatus = statusFilter === 'All' || m.status === statusFilter.toLowerCase();
    return matchSearch && matchRole && matchStatus;
  });

  // ── logAudit helper ──────────────────────────────────────────────────────────
  const logAudit = (actionType, description) => {
    if (user?.id) profileService.logAuditEntry(user.id, actionType, description);
  };

  // ── Open modals ─────────────────────────────────────────────────────────────
  const openAdd    = ()  => setModal('add');
  const openEdit   = (m) => { setActive(m); setModal('edit');    };
  const openDisable = (m) => { setActive(m); setModal('disable'); };
  const openEnable  = (m) => { setActive(m); setModal('enable');  };
  const openReset   = (m) => { setActive(m); setModal('reset');   };
  const closeModal = () => { setModal(null); setActive(null); };

  // ── Add member ──────────────────────────────────────────────────────────────
  const handleAdd = async (form) => {
    setActing(true);
    try {
      const result = await profileService.createAuthAndProfile(form, user?.id);
      logAudit('Member Created', `Created profile for ${form.name} (${form.memberId}) with role ${form.role}.`);
      await fetchMembers();

      // Show the temporary password modal
      const returnedPassword = result?.tempPassword || result?.temp_password;
      if (returnedPassword) {
        setTempPassword(returnedPassword);
        setTempUserName(form.name);
        setModal('temp_password');
        setActive(null);
      } else {
        addToast('Account created, but no temporary password was returned. The user may need a password reset.', 'warning');
        closeModal();
      }
    } catch (err) {
      console.error('Create member error:', err);
      const msg = err?.message || 'Unknown error';
      addToast(`Failed to create account: ${msg}`, 'error');
    }
    setActing(false);
  };

  // ── Edit member ─────────────────────────────────────────────────────────────
  const handleEdit = async (form) => {
    setActing(true);
    try {
      const changed = [];
      if (form.name       !== (active.full_name || active.name)) changed.push('full_name');
      if (form.phone      !== active.phone)      changed.push('phone');
      if (form.role       !== active.role)       changed.push('role');
      if (form.department !== active.department) changed.push('department');

      const { error } = await profileService.updateProfile(active.id, form);
      if (error) throw error;

      logAudit('Member Updated', `Updated profile ${active.member_id}. Fields changed: ${changed.join(', ') || 'none'}.`);
      addToast('Member updated successfully.', 'success');
      closeModal();
      await fetchMembers();
    } catch (err) {
      console.error('Edit member error:', err);
      addToast('Failed to update. Please try again.', 'error');
    }
    setActing(false);
  };

  // ── Disable account ─────────────────────────────────────────────────────────
  const handleDisable = async () => {
    setActing(true);
    try {
      const { error } = await profileService.updateProfileStatus(active.id, 'disabled');
      if (error) throw error;
      logAudit('Account Disabled', `Disabled account for ${active.full_name || active.name} (${active.member_id}).`);
      addToast('Account disabled.', 'success');
      closeModal();
      await fetchMembers();
    } catch {
      addToast('Failed to disable account. Please try again.', 'error');
    }
    setActing(false);
  };

  // ── Enable account ──────────────────────────────────────────────────────────
  const handleEnable = async () => {
    setActing(true);
    try {
      const { error } = await profileService.updateProfileStatus(active.id, 'active');
      if (error) throw error;
      logAudit('Account Enabled', `Enabled account for ${active.full_name || active.name} (${active.member_id}).`);
      addToast('Account enabled.', 'success');
      closeModal();
      await fetchMembers();
    } catch {
      addToast('Failed to enable account. Please try again.', 'error');
    }
    setActing(false);
  };

  // ── Reset password — generates a new temporary password ────────────────────
  const handleReset = async () => {
    setActing(true);
    try {
      const { data, error } = await profileService.resetPassword(active.id);
      if (error) throw error;
      const pwd = data?.tempPassword || data?.temp_password;
      if (!pwd) throw new Error('No temporary password returned by the server. Please ensure the reset-password edge function is deployed.');
      logAudit(
        'Temporary Password Reset',
        `Temporary password reset for ${active.full_name || active.name} by ${user?.full_name || user?.name || 'Super Admin'}.`
      );

      // Show the temporary password modal
      setTempPassword(pwd);
      setTempUserName(active.full_name || active.name);
      setModal('temp_password');
    } catch (err) {
      console.error('Password reset error:', err);
      const msg = err?.message || 'Unknown error';
      addToast(`Failed to reset password: ${msg}`, 'error');
    }
    setActing(false);
  };

  // ── Icon button style ────────────────────────────────────────────────────────
  const iconBtn = (color) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color, padding: '4px', borderRadius: '4px', lineHeight: 0,
  });

  const selectStyle = {
    height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)',
    padding: '0 12px', outline: 'none', fontSize: '14px', backgroundColor: 'var(--white)',
  };

  return (
    <div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Members</h2>
        <p style={{ color: 'var(--text-mid)' }}>Manage welfare members and user accounts.</p>
      </div>

      {/* ── Filter + Action Bar ── */}
      <Card style={{ padding: '16px 24px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="text"
              placeholder="Search by name or member ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, width: '100%', paddingLeft: '32px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Role filter */}
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle}>
            <option value="All">All Roles</option>
            <option value="Treasurer">Treasurer</option>
            <option value="Chairman">Chairman</option>
            <option value="Secretary">Secretary</option>
            <option value="Auditor">Auditor</option>
            <option value="Member">Member</option>
          </select>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>

          <div style={{ flex: 1 }} />

          <Button onClick={openAdd}>
            <UserPlus size={16} style={{ marginRight: '8px' }} /> Add New Member
          </Button>
        </div>
      </Card>

      {/* ── Members Table ── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                {['Member ID', 'Full Name', 'Role', 'Email', 'Phone', 'Status', 'Date Added', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '13px 20px', fontWeight: '600', textAlign: h === 'Actions' ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : displayed.length === 0
                  ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-mid)' }}>
                        <Search size={36} style={{ opacity: 0.25, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '15px', fontWeight: '500' }}>No members found matching your search.</div>
                        <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-light)' }}>Try adjusting your filters or search term.</div>
                      </td>
                    </tr>
                  )
                  : displayed.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: 'var(--primary-mid)', letterSpacing: '0.3px' }}>
                        {m.member_id || '—'}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {m.full_name}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <RoleBadge role={m.role} />
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>
                        {m.email}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>
                        {m.phone || '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <Badge variant={m.status === 'active' ? 'success' : 'danger'}>
                          {m.status === 'active' ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>
                        {fmtDate(m.created_at)}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center' }}>
                          {/* Edit */}
                          <button title="Edit member" style={iconBtn('var(--primary-mid)')} onClick={() => openEdit(m)}>
                            <Edit2 size={16} />
                          </button>
                          {/* Disable / Enable */}
                          {m.status === 'active'
                            ? (
                              <button title="Disable account" style={iconBtn('var(--danger)')} onClick={() => openDisable(m)}>
                                <Ban size={16} />
                              </button>
                            ) : (
                              <button title="Enable account" style={iconBtn('var(--success)')} onClick={() => openEnable(m)}>
                                <CheckCircle size={16} />
                              </button>
                            )
                          }
                          {/* Reset Password — super_admin only */}
                          {isSuperAdmin && (
                            <button title="Reset password" style={iconBtn('var(--text-mid)')} onClick={() => openReset(m)}>
                              <Key size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modals ── */}

      {modal === 'add' && (
        <MemberFormModal mode="add" onClose={closeModal} onSave={handleAdd} currentUserId={user?.id} isSuperAdmin={isSuperAdmin} submitting={acting} />
      )}

      {modal === 'edit' && active && (
        <MemberFormModal mode="edit" member={active} onClose={closeModal} onSave={handleEdit} currentUserId={user?.id} isSuperAdmin={isSuperAdmin} submitting={acting} />
      )}

      {modal === 'disable' && active && (
        <ConfirmModal
          title="Disable Account"
          body={`This account will be disabled. ${active.full_name} will not be able to log in, but all their records and history will be preserved.`}
          confirmLabel="Disable Account"
          confirmVariant="danger"
          onClose={closeModal}
          onConfirm={handleDisable}
          loading={acting}
        />
      )}

      {modal === 'enable' && active && (
        <ConfirmModal
          title="Enable Account"
          body={`This will reactivate ${active.full_name}'s account. They will be able to log in again.`}
          confirmLabel="Enable Account"
          confirmVariant="primary"
          onClose={closeModal}
          onConfirm={handleEnable}
          loading={acting}
        />
      )}

      {modal === 'reset' && active && (
        <ConfirmModal
          title="Reset Password"
          body={`This will generate a new temporary password for ${active.full_name || active.name}. They will be required to set a new password on their next login. Continue?`}
          confirmLabel="Generate Temporary Password"
          confirmVariant="primary"
          onClose={closeModal}
          onConfirm={handleReset}
          loading={acting}
        />
      )}

      {modal === 'temp_password' && tempPassword && (
        <TempPasswordModal
          password={tempPassword}
          userName={tempUserName}
          onDone={() => { setModal(null); setActive(null); setTempPassword(''); setTempUserName(''); }}
        />
      )}
    </div>
  );
}
