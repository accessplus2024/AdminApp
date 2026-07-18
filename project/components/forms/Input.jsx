import React from 'react';

/** Text input. Pass `icon` (a Lucide node) for a leading icon. */
export function Input({ icon = null, error = false, className = '', ...props }) {
  const input = (
    <input
      className={['ap-input', error ? 'ap-input--error' : '', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
  if (icon) {
    return (
      <div className="ap-input-group">
        {icon}
        {input}
      </div>
    );
  }
  return input;
}
