import React from 'react';

/** Surface container. Compose with the sub-components below. */
export function Card({ interactive = false, flat = false, className = '', children, ...props }) {
  const classes = [
    'ap-card',
    flat ? 'ap-card--flat' : '',
    interactive ? 'ap-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return <div className={`ap-card-header ${className}`} {...props}>{children}</div>;
}

export function CardTitle({ className = '', children, ...props }) {
  return <div className={`ap-card-title ${className}`} {...props}>{children}</div>;
}

export function CardDescription({ className = '', children, ...props }) {
  return <div className={`ap-card-desc ${className}`} {...props}>{children}</div>;
}

export function CardBody({ className = '', children, ...props }) {
  return <div className={`ap-card-body ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ className = '', children, ...props }) {
  return <div className={`ap-card-footer ${className}`} {...props}>{children}</div>;
}
