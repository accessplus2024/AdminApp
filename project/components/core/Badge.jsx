import React from 'react';

/** Small status / category label. */
export function Badge({
  variant = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'ap-badge',
    `ap-badge--${variant}`,
    dot ? 'ap-badge--dot' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
