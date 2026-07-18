import React from 'react';

/** Centered modal dialog with scrim. Controlled via `open` / `onClose`. */
export function Dialog({ open, onClose, title, description, footer, width = 460, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(14,0,51,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width,
          background: 'var(--card)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 'var(--space-6) var(--space-6) 0' }}>
          {title != null && (
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-xl)', letterSpacing: 'var(--tracking-tight)' }}>
              {title}
            </h2>
          )}
          {description != null && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)', marginTop: 6 }}>
              {description}
            </p>
          )}
        </div>
        <div style={{ padding: 'var(--space-5) var(--space-6)' }}>{children}</div>
        {footer != null && (
          <div style={{ padding: '0 var(--space-6) var(--space-6)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
