import React from 'react';

/**
 * Tabs / segmented control.
 * `items`: [{ value, label }]; controlled via `value` + `onChange`.
 */
export function Tabs({ items = [], value, onChange, variant = 'solid', className = '' }) {
  return (
    <div
      role="tablist"
      className={['ap-tabs', variant === 'line' ? 'ap-tabs--line' : '', className].filter(Boolean).join(' ')}
    >
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          className="ap-tab"
          data-active={value === it.value}
          aria-selected={value === it.value}
          onClick={() => onChange && onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
