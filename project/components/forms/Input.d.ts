import * as React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Leading icon node (e.g. <i data-lucide="search" />). */
  icon?: React.ReactNode;
  /** Apply the error styling (red border + ring). */
  error?: boolean;
  className?: string;
}

export declare function Input(props: InputProps): JSX.Element;
