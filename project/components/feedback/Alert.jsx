import React from 'react';

/** Inline message banner. Pass `icon` (Lucide node) and optional `title`. */
export function Alert({ variant = 'info', icon = null, title, className = '', children, ...props }) {
  return (
    <div className={['ap-alert', `ap-alert--${variant}`, className].filter(Boolean).join(' ')} role="status" {...props}>
      {icon}
      <div>
        {title != null && <div className="ap-alert-title">{title}</div>}
        {children != null && <div className="ap-alert-desc">{children}</div>}
      </div>
    </div>
  );
}
