import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, checkFirstLogin } = useAuth();
  const navigate = useNavigate();

  if (user) {
    if (checkFirstLogin(user)) {
      return <Navigate to="/reset-password" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Left Panel */}
      <div style={{ width: '45%', padding: '4rem', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--white)' }}>
        <div style={{ fontWeight: '700', fontSize: '20px', color: 'var(--primary-dark)', marginBottom: 'auto' }}>
          Welfare Platform
        </div>

        <div style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px', color: 'var(--text-dark)', marginBottom: '8px' }}>Welcome back.</h1>
          <p style={{ color: 'var(--text-mid)', marginBottom: '32px' }}>Sign in to your account to continue.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input 
              label="Email Address" 
              type="email" 
              id="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ width: '100%' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-mid)' }}>Forgotten your password? Contact your administrator.</span>
              </div>
              <div style={{ position: 'relative' }}>
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  id="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  style={{ width: '100%', paddingRight: '50px' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', 
                    fontSize: '13px', color: '#64748b', fontWeight: '500'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', backgroundColor: 'var(--pale-blue)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <Button type="submit" className="w-full mt-4" disabled={loading}>
              {loading ? 'Sign In...' : 'Sign In'}
            </Button>
          </form>

          <p style={{ marginTop: '2rem', fontSize: '13px', color: 'var(--text-mid)', textAlign: 'center' }}>
            Don't have an account? Contact your administrator.
          </p>
        </div>
        
        <div style={{ marginTop: 'auto' }}></div>
      </div>

      {/* Right Panel */}
      <div style={{ 
        width: '55%', 
        backgroundImage: 'url(/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dark overlay for text legibility */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          pointerEvents: 'none'
        }} />
        <h2 style={{ color: '#ffffff', fontSize: '40px', fontWeight: '700', zIndex: 1, textAlign: 'center', padding: '0 2rem', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          Welfare, accounted for.
        </h2>
      </div>
    </div>
  );
}
