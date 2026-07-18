import React from 'react';

/**
 * Access+Plus Button — shadcn-flavoured, brand-styled.
 * Renders an <a> when `href` is provided, otherwise a <button>.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  iconLeft = null,
  iconRight = null,
  className = '',
  href,
  type = 'button',
  children,
  ...props
}) {
  const classes = [
    'ap-btn',
    `ap-btn--${variant}`,
    size === 'icon' ? 'ap-btn--icon' : `ap-btn--${size}`,
    pill ? 'ap-btn--pill' : '',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} {...props}>
      {content}
    </button>
  );
}
