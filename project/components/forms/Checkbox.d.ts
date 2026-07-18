import * as React from 'react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional inline label rendered to the right of the box. */
  label?: React.ReactNode;
  className?: string;
}

export declare function Checkbox(props: CheckboxProps): JSX.Element;
