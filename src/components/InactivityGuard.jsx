import React from 'react';
import { useInactivityLogout } from '../hooks/useInactivityLogout';

/**
 * Invisible guard that activates the inactivity auto-logout timer.
 * When the warning phase begins (30 seconds before logout), it renders
 * a modal overlay with a live countdown and a "Continue This Session" button.
 *
 * Placed once in App.jsx inside <AuthProvider>. No other components are
 * modified or affected.
 */
export function InactivityGuard() {
  const { showWarning, countdown, dismissWarning } = useInactivityLogout();

  if (!showWarning) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '16px', width: '100%',
        maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden', animation: 'inactivity-pop 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>⏳</span>
          <h2 style={{
            margin: 0, fontSize: '17px', fontWeight: '700',
            color: '#1E3A5F',
          }}>
            Session Timeout Warning
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{
            margin: '0 0 20px', fontSize: '14px', color: '#64748B',
            lineHeight: '1.6',
          }}>
            You have been inactive for a while. For your security, you will be
            automatically logged out in:
          </p>

          {/* Countdown ring */}
          <div style={{
            width: '96px', height: '96px', margin: '0 auto 20px',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative',
          }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              <circle
                cx="48" cy="48" r="42"
                fill="none" stroke="#E2E8F0" strokeWidth="6"
              />
              <circle
                cx="48" cy="48" r="42"
                fill="none"
                stroke={countdown <= 10 ? '#DC2626' : '#D97706'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - countdown / 30)}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
              />
            </svg>
            <span style={{
              fontSize: '32px', fontWeight: '800',
              fontVariantNumeric: 'tabular-nums',
              color: countdown <= 10 ? '#DC2626' : '#D97706',
              transition: 'color 0.3s ease',
              position: 'relative',
            }}>
              {countdown}
            </span>
          </div>

          <p style={{
            margin: '0 0 4px', fontSize: '13px', color: '#94A3B8',
          }}>
            seconds remaining
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={dismissWarning}
            style={{
              width: '100%', padding: '12px 24px', fontSize: '14px',
              fontWeight: '700', color: '#fff', border: 'none',
              borderRadius: '10px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #1A56DB 0%, #1E3A5F 100%)',
              boxShadow: '0 2px 8px rgba(26,86,219,0.35)',
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Continue This Session
          </button>
        </div>
      </div>

      {/* Pop-in animation */}
      <style>{`
        @keyframes inactivity-pop {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
