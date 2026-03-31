import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, 
  Wallet, 
  Calendar, 
  Receipt, 
  BarChart, 
  ShieldAlert, 
  Users, 
  Settings, 
  User, 
  LogOut 
} from 'lucide-react';

const MENU_ITEMS = [
  { label: 'Dashboard',     path: '/dashboard',     icon: Home,       roles: ['super_admin', 'treasurer', 'chairman', 'secretary', 'auditor', 'member'] },
  { label: 'Contributions', path: '/contributions', icon: Wallet,     roles: ['super_admin', 'treasurer', 'secretary', 'auditor', 'member'] },
  { label: 'Events',        path: '/events',        icon: Calendar,   roles: ['super_admin', 'treasurer', 'chairman', 'secretary', 'auditor', 'member'] },
  { label: 'Expenses',      path: '/expenses',      icon: Receipt,    roles: ['super_admin', 'treasurer', 'auditor', 'member'] },
  { label: 'Reports',       path: '/reports',       icon: BarChart,   roles: ['super_admin', 'treasurer', 'chairman', 'secretary', 'auditor', 'member'] },
  { label: 'Audit Log',     path: '/audit',         icon: ShieldAlert, roles: ['super_admin', 'auditor', 'member'] },
  { label: 'Members',       path: '/members',       icon: Users,      roles: ['super_admin', 'chairman'] },
  { label: 'Settings',      path: '/settings',      icon: Settings,   roles: ['super_admin', 'treasurer'] },
];

export function Sidebar({ onClose }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const allowedItems = MENU_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <aside style={{
      width: '240px',
      backgroundColor: 'var(--primary-dark)',
      color: 'var(--white)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0
    }}>
      <div style={{ padding: '1.5rem 1.5rem', fontWeight: '700', fontSize: '20px', letterSpacing: '0.5px' }}>
        WelfarePlatform
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem 0', overflowY: 'auto' }}>
        {allowedItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              color: 'var(--white)',
              textDecoration: 'none',
              borderLeft: `4px solid ${isActive ? 'var(--primary-mid)' : 'transparent'}`,
              backgroundColor: isActive ? '#1a3a6b' : 'transparent',
              transition: 'background-color 0.2s',
              fontSize: '14px',
              fontWeight: isActive ? '600' : '400'
            })}
            className="sidebar-link"
          >
            <item.icon size={18} style={{ marginRight: '12px', opacity: 0.8 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0, fontWeight: 'bold' }}>
            {user?.email?.[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.full_name || user?.email.split('@')[0]}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
              {user?.role ? user.role.replace('_', ' ') : 'User'}
            </div>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--text-light)',
            cursor: 'pointer',
            padding: '0.5rem',
            fontSize: '13px',
            transition: 'color 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--white)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-light)'}
        >
          <LogOut size={16} style={{ marginRight: '8px' }} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
