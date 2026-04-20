import React from 'react';

const variantStyles = {
  primary: {
    backgroundColor: 'var(--primary-mid)',
    color: 'var(--white)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--white)',
    color: 'var(--primary-mid)',
    border: '1px solid var(--primary-mid)',
  },
  danger: {
    backgroundColor: 'var(--danger)',
    color: 'var(--white)',
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--primary-mid)',
    border: 'none',
  },
};

export function Button({ children, variant = 'primary', loading = false, style = {}, type = 'button', ...props }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    padding: '0 1.25rem',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    opacity: props.disabled || loading ? 0.6 : 1,
    transition: 'all 0.2s',
    outline: 'none',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...variantStyles[variant] || variantStyles.primary,
    ...style,
  };

  return (
    <button type={type} style={base} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block', width: '14px', height: '14px',
            border: '2px solid currentColor', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'btn-spin 0.6s linear infinite',
            flexShrink: 0,
          }} />
          Processing…
        </span>
      ) : children}
    </button>
  );
}
