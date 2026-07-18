import * as React from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  /** Leading icon node (e.g. <i data-lucide="info" />). */
  icon?: React.ReactNode;
  /** Bold title line. */
  title?: React.ReactNode;
  className?: string;
  /** Description / body text. */
  children?: React.ReactNode;
}

export declare function Alert(props: AlertProps): JSX.Element;
