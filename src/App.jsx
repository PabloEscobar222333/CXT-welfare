import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/auth/Login';
import { ResetPassword } from './pages/auth/ResetPassword';

import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { Members } from './pages/members/Members';
import { Contributions } from './pages/contributions/Contributions';
import { Events } from './pages/events/Events';
import { EventDetail } from './pages/events/EventDetail';
import { Expenses } from './pages/expenses/Expenses';
import { Reports } from './pages/reports/Reports';
import { AuditLog } from './pages/audit/AuditLog';
import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Settings } from './pages/settings/Settings';

const Placeholder = ({ title }) => {
  const { signOut, user } = useAuth();
  
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '24px' }}>{title}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-mid)', fontWeight: '500' }}>
            Logged in as: {user?.email} ({user?.role})
          </span>
          <Button variant="secondary" onClick={signOut}>Sign Out</Button>
        </div>
      </div>
      <Card>
        <p style={{ color: 'var(--text-mid)' }}>This page ({title}) is a placeholder scaffolded for Phase 1. It will be built in a future phase.</p>
      </Card>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, checkFirstLogin } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (checkFirstLogin(user)) {
    return <Navigate to="/reset-password" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Wraps a ProtectedRoute with an additional role-whitelist check.
// If the user's role is not in `allowedRoles`, redirect them to /dashboard.
const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <ProtectedRoute>{children}</ProtectedRoute>;
};



export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/contributions" element={<ProtectedRoute><Contributions /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
              <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
              <Route path="/members" element={<RoleProtectedRoute allowedRoles={['super_admin', 'chairman', 'secretary', 'auditor', 'member']}><Members /></RoleProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/my-account" element={<ProtectedRoute><Placeholder title="My Account" /></ProtectedRoute>} />

              {/* Fallback */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
