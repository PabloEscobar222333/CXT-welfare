import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../services/api';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // recoveryMode = true  → user arrived via a password-reset email link
  //                false → first-login forced change (already signed in)
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);

  const { user, updatePassword } = useAuth();
  const navigate = useNavigate();

  // Detect recovery mode via two methods (both are needed):
  //
  // 1. URL hash check — reliable when App.jsx routed the user here with the
  //    #access_token=...&type=recovery hash. The Supabase client may have
  //    already processed the hash before this component mounted, so the
  //    PASSWORD_RECOVERY event won't fire again — the hash check catches it.
  //
  // 2. onAuthStateChange — catches the event when the user lands directly on
  //    /reset-password (e.g. from the admin-generated shareable link).
  useEffect(() => {
    // Method 1: check URL hash immediately on mount
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setRecoveryMode(true);
      setTokenReady(true);
    }

    // Method 2: event listener for direct link arrivals
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setTokenReady(true);
      }
    });

    // If user is already logged in with must_change_password, mark ready
    if (user && user.must_change_password) {
      setTokenReady(true);
    }

    return () => subscription.unsubscribe();
  }, [user]);

  // ── Route protection ─────────────────────────────────────────────────────────
  // Recovery mode: stay on this page even if user is not in state yet
  // Forced-change mode: must be logged in with the flag set
  if (!recoveryMode) {
    if (!user) return <Navigate to="/login" replace />;
    if (!user.must_change_password) return <Navigate to="/dashboard" replace />;
  }

  const reqs = {
    length:  password.length >= 10,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const allMet =
    Object.values(reqs).every(Boolean) &&
    password === confirmPassword &&
    password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allMet) return;
    setError('');
    setSubmitting(true);

    try {
      await updatePassword(password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Password update failed:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show a spinner while waiting for the Supabase recovery token
  if (recoveryMode && !tokenReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-mid)' }}>Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '440px', width: '100%', backgroundColor: 'var(--white)', padding: '2.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Set your new password</h1>
        <p style={{ color: 'var(--text-mid)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
          {recoveryMode
            ? 'Enter a new password for your account below.'
            : 'Your account was created with a temporary password. You must set a new password before you can access the platform.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <div style={{ backgroundColor: 'var(--pale-blue)', padding: '16px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-mid)' }}>
            <div style={{ marginBottom: '8px', fontWeight: '500' }}>Password requirements:</div>
            <div style={{ color: reqs.length  ? 'var(--success)' : 'inherit' }}>{reqs.length  ? '✓' : '✗'} Minimum 10 characters</div>
            <div style={{ color: reqs.upper   ? 'var(--success)' : 'inherit' }}>{reqs.upper   ? '✓' : '✗'} One uppercase letter</div>
            <div style={{ color: reqs.lower   ? 'var(--success)' : 'inherit' }}>{reqs.lower   ? '✓' : '✗'} One lowercase letter</div>
            <div style={{ color: reqs.number  ? 'var(--success)' : 'inherit' }}>{reqs.number  ? '✓' : '✗'} One number</div>
            <div style={{ color: reqs.special ? 'var(--success)' : 'inherit' }}>{reqs.special ? '✓' : '✗'} One special character</div>
            <div style={{ marginTop: '4px', color: (password === confirmPassword && password.length > 0) ? 'var(--success)' : 'inherit' }}>
              {password === confirmPassword && password.length > 0 ? '✓' : '✗'} Passwords match
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-4" disabled={!allMet || submitting} loading={submitting}>
            Set Password &amp; Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
