import React from 'react';

const variantStyles = {
  default:  { backgroundColor: '#F1F5F9', color: '#475569' },
  neutral:  { backgroundColor: '#F1F5F9', color: '#475569' },
  success:  { backgroundColor: '#DCFCE7', color: '#16A34A' },
  warning:  { backgroundColor: '#FEF3C7', color: '#D97706' },
  danger:   { backgroundColor: '#FEE2E2', color: '#DC2626' },
  info:     { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  primary:  { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  purple:   { backgroundColor: '#F3E8FF', color: '#7C3AED' },
  gray:     { backgroundColor: '#F1F5F9', color: '#64748B' },
};

export function Badge({ children, variant = 'default' }) {
  const style = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize',
    ...(variantStyles[variant] || variantStyles.default),
  };
  return <span style={style}>{children}</span>;
}
