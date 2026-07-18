import React from 'react';

/** Label + control + hint wrapper for form fields. */
export function Field({ label, htmlFor, hint, error, className = '', children }) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      {label != null && (
        <label className="ap-field-label" htmlFor={htmlFor}>{label}</label>
      )}
      {children}
      {(hint != null || error != null) && (
        <span className={['ap-field-hint', error != null ? 'ap-field-hint--error' : ''].filter(Boolean).join(' ')}>
          {error != null ? error : hint}
        </span>
      )}
    </div>
  );
}
