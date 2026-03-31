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

export function Button({ children, variant = 'primary', loading = false, style = {}, ...props }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    padding: '0 1rem',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    opacity: props.disabled || loading ? 0.5 : 1,
    transition: 'all 0.2s',
    outline: 'none',
    whiteSpace: 'nowrap',
    ...variantStyles[variant] || variantStyles.primary,
    ...style,
  };

  return (
    <button style={base} disabled={loading || props.disabled} {...props}>
      {loading ? 'Saving...' : children}
    </button>
  );
}
