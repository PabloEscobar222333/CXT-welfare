import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { sendPasswordReset } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await sendPasswordReset(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '440px', width: '100%', backgroundColor: 'var(--white)', padding: '2.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
        
        {!sent ? (
          <>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Reset Password</h1>
            <p style={{ color: 'var(--text-mid)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input 
                label="Email Address" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--light-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ color: 'var(--primary-mid)', fontSize: '24px' }}>✓</span>
            </div>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Check your email</h1>
            <p style={{ color: 'var(--text-mid)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              If that email is registered, a reset link has been sent. It will expire in 15 minutes.
            </p>
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: '14px', fontWeight: '500' }}>← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
