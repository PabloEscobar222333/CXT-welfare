import React from 'react';

export function Input({ label, error, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-mid)' }}>
          {label}
        </label>
      )}
      <input
        style={{
          height: '40px',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
          borderRadius: '8px',
          backgroundColor: 'var(--pale-blue)',
          padding: '0 0.75rem',
          fontSize: '14px',
          color: 'var(--text-dark)',
          outline: 'none',
          width: '100%',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'var(--primary-mid)';
          e.target.style.boxShadow = '0 0 0 2px var(--light-blue)';
          e.target.style.backgroundColor = 'var(--white)';
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-color)';
          e.target.style.boxShadow = 'none';
          e.target.style.backgroundColor = 'var(--pale-blue)';
        }}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
