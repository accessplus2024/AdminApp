import * as React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Primary interactive control for the Access+ admin app.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `primary` is the only "action" colour (azul). */
  variant?: ButtonVariant;
  /** Control height. Use `icon` for square icon-only buttons. */
  size?: ButtonSize;
  /** Fully-rounded pill shape (brand lockup feel). */
  pill?: boolean;
  /** Icon node rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Icon node rendered after the label. */
  iconRight?: React.ReactNode;
  /** Render as an anchor with this href instead of a button. */
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
