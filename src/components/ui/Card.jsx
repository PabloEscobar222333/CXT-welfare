import React from 'react';

export function Card({ children, style = {}, ...props }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--white)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.5rem',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
