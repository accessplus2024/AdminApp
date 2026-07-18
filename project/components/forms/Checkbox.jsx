import React from 'react';

/** Checkbox with brand azul fill + check glyph. */
export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={['ap-check', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...props} />
      <span className="ap-check-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
