import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, User as UserIcon, Menu, X, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { memberService } from '../../services/api';

// ─── Password rule indicators ─────────────────────────────────────────────────
const PW_RULES = [
  { label: 'At least 10 characters', test: v => v.length >= 10 },
  { label: 'Uppercase letter',        test: v => /[A-Z]/.test(v) },
  { label: 'Lowercase letter',        test: v => /[a-z]/.test(v) },
  { label: 'Number',                  test: v => /\d/.test(v) },
  { label: 'Special character',       test: v => /[!@#$%^&*(),.?":{}|<>_\-]/.test(v) },
];

function PwRules({ value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', margin: '8px 0 14px' }}>
      {PW_RULES.map(r => {
        const ok = value.length > 0 && r.test(value);
        return (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: ok ? 'var(--success)' : 'var(--text-light)' }}>
            {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {r.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared modal sub-components (defined at module level to prevent remounting) ─
function ModalRow({ label, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-mid)', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  );
}

function ReadOnly({ value }) {
  return (
    <div style={{ height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: '14px', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
      {value || '—'}
    </div>
  );
}

// Defined at module level so React never sees a new component type on re-render
// (inline arrow functions inside render cause inputs to lose focus every keystroke)
function PwField({ value, onChange, show, setShow }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ height: '40px', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 40px 0 12px', fontSize: '14px', outline: 'none', backgroundColor: 'var(--pale-blue)' }}
      />
      <button type="button" onClick={() => setShow(!show)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 0, display: 'flex', alignItems: 'center' }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ─── Profile / Change Password Modal ─────────────────────────────────────────
function ProfileModal({ initialTab, onClose }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState(initialTab || 'profile');

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const pwMatch = confirmPw.length === 0 || newPw === confirmPw;
  const allRulesOk = newPw.length > 0 && PW_RULES.every(r => r.test(newPw));


  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      if (user?.id) await memberService.updateMember(user.id, { full_name: fullName, phone });
      addToast('Profile updated.', 'success');
      onClose();
    } catch {
      addToast('Failed to update profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePwSave = async (e) => {
    e.preventDefault();
    if (!allRulesOk) { addToast('Password does not meet all requirements.', 'error'); return; }
    if (!pwMatch)    { addToast('Passwords do not match.', 'error'); return; }
    setPwLoading(true);
    try {
      const { supabase } = await import('../../services/api');
      if (supabase) await supabase.auth.updateUser({ password: newPw });
      addToast('Password updated.', 'success');
      onClose();
    } catch {
      addToast('Failed to update password.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: tab === id ? '700' : '400', color: tab === id ? 'var(--primary-mid)' : 'var(--text-mid)', borderBottom: '2px solid ' + (tab === id ? 'var(--primary-mid)' : 'transparent'), transition: 'all 0.15s' }}
    >{label}</button>
  );

  // ROW is a render helper (not a component), so calling it as a function is safe
  const ROW = (label, content) => <ModalRow label={label}>{content}</ModalRow>;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,45,92,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '460px', backgroundColor: 'var(--white)', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--pale-blue)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary-dark)' }}>{user?.full_name || 'My Account'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{(user?.role || 'member').replace(/_/g, ' ')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px', display: 'flex' }}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          {tabBtn('profile', 'Profile')}
          {tabBtn('password', 'Change Password')}
        </div>

        {/* Scrollable content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {tab === 'profile' && (
            <form onSubmit={handleProfileSave}>
              {ROW('Full Name', <Input value={fullName} onChange={e => setFullName(e.target.value)} />)}
              {ROW('Email', <>
                <ReadOnly value={user?.email} />
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Contact admin to change.</span>
              </>)}
              {ROW('Phone Number', <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />)}
              {ROW('Role', <>
                <ReadOnly value={(user?.role || 'member').replace(/_/g, ' ')} />
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>Contact admin to change.</span>
              </>)}
              {ROW('Member ID', <ReadOnly value={user?.member_id} />)}
              <Button type="submit" loading={profileLoading} style={{ width: '100%', marginTop: '8px' }}>Save Changes</Button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handlePwSave}>
              {ROW('Current Password',
                <PwField value={currentPw} onChange={setCurrentPw} show={showCurrent} setShow={setShowCurrent} />
              )}
              {ROW('New Password', <>
                <PwField value={newPw} onChange={setNewPw} show={showNew} setShow={setShowNew} />
                <PwRules value={newPw} />
              </>)}
              {ROW('Confirm New Password',
                <>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    style={{ height: '40px', width: '100%', border: '1px solid ' + (!pwMatch ? 'var(--danger)' : 'var(--border-color)'), borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', backgroundColor: 'var(--pale-blue)' }}
                  />
                  {!pwMatch && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>Passwords do not match.</span>}
                </>
              )}
              <Button type="submit" loading={pwLoading} style={{ width: '100%', marginTop: '8px' }}>Update Password</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState('profile');
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications = [
    { id: 1, text: 'Kwame Mensah logged a new expense for End of Year Party', time: '10 mins ago', read: false },
    { id: 2, text: 'Ama Osei paid GHS 50.00 contribution', time: '1 hour ago', read: true },
  ];

  const getPageTitle = () => {
    const route = pathname.split('/')[1];
    if (!route) return 'Dashboard';
    return route.charAt(0).toUpperCase() + route.slice(1).replace(/-/g, ' ');
  };

  const openProfile = (tab) => {
    setProfileInitialTab(tab);
    setDropdownOpen(false);
    setProfileOpen(true);
  };

  return (
    <>
      <header style={{ height: '64px', backgroundColor: 'var(--white)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="mobile-menu-btn" onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', display: 'none', padding: 0 }}>
            <Menu size={24} />
          </button>
          <h1 style={{ fontSize: '20px', margin: 0 }}>{getPageTitle()}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }} ref={wrapRef}>
          {/* Search */}
          <div className="header-search" style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input type="text" placeholder="Search..." style={{ height: '36px', paddingLeft: '36px', paddingRight: '12px', borderRadius: '18px', border: '1px solid var(--border-color)', backgroundColor: 'var(--pale-blue)', fontSize: '13px', outline: 'none', width: '240px' }} />
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setNotifOpen(p => !p); setDropdownOpen(false); }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center' }}>
              <Bell size={20} />
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', backgroundColor: 'var(--danger)', borderRadius: '50%' }} />
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: '-60px', width: '300px', backgroundColor: 'var(--white)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', zIndex: 50, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--pale-blue)' }}>
                  <h3 style={{ margin: 0, fontSize: '14px' }}>Notifications</h3>
                  <button onClick={() => { addToast('Marked read', 'success'); setNotifOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--primary-mid)', fontSize: '12px', cursor: 'pointer' }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: n.read ? 'var(--white)' : '#f0f9ff' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-dark)', marginBottom: '4px', lineHeight: '1.4' }}>{n.text}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{n.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setDropdownOpen(p => !p); setNotifOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--light-blue)', color: 'var(--primary-mid)' }}>
              <UserIcon size={18} />
            </button>
            {dropdownOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '210px', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--pale-blue)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.full_name || 'User'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '2px' }}>{user?.email}</div>
                </div>
                <button onClick={() => openProfile('profile')} style={{ padding: '10px 16px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-dark)' }}>My Profile</button>
                <button onClick={() => openProfile('password')} style={{ padding: '10px 16px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-dark)' }}>Change Password</button>
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }} />
                <button onClick={async () => { setDropdownOpen(false); await signOut(); navigate('/login'); }} style={{ padding: '10px 16px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--danger)' }}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {profileOpen && <ProfileModal initialTab={profileInitialTab} onClose={() => setProfileOpen(false)} />}

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .mobile-menu-btn { display: block !important; }
          .header-search   { display: none !important; }
        }
      `}} />
    </>
  );
}
