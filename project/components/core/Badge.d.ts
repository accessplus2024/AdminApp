import * as React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'lime'
  | 'pink'
  | 'mint'
  | 'solid';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Colour treatment. Highlighter colours (lime/pink/mint) are for categories. */
  variant?: BadgeVariant;
  /** Show a leading status dot in the current colour. */
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export declare function Badge(props: BadgeProps): JSX.Element;
