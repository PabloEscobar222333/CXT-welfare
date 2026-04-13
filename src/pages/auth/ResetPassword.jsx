import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auditService } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

/**
 * Forced password-change screen.
 *
 * This page is shown when a user logs in with a temporary password
 * (must_change_password = true). It is non-escapable — no back button,
 * no navigation, no skip. The user MUST set a new permanent password
 * before accessing any part of the platform.
 *
 * There is NO recovery-link / email-based flow. All password resets
 * are admin-mediated (see Members page).
 */
export function ResetPassword() {
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');

  const { user, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Route protection ──────────────────────────────────────────────────────
  // Must be logged in and must_change_password must be true.
  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) return <Navigate to="/dashboard" replace />;

  // ── Password strength requirements ────────────────────────────────────────
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

      // Audit log — record the password change
      try {
        await auditService.logAction(
          user.id,
          'Password Changed',
          'Password changed by user after first login / admin reset'
        );
      } catch (auditErr) {
        console.warn('Audit log failed (non-blocking):', auditErr);
      }

      // Sign out so the user logs in fresh with their new password.
      // This invalidates the old session and ensures a clean state.
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Password update failed:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '440px', width: '100%', backgroundColor: 'var(--white)', padding: '2.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Set your new password</h1>
        <p style={{ color: 'var(--text-mid)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
          Your account was created with a temporary password. You must set a new password before you can access the platform.
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
