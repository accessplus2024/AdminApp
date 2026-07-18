import * as React from 'react';

export interface FieldProps {
  /** Field label text. */
  label?: React.ReactNode;
  /** `for` attribute, matched to the control id. */
  htmlFor?: string;
  /** Helper text shown below the control. */
  hint?: React.ReactNode;
  /** Error message — when present, overrides hint and turns red. */
  error?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export declare function Field(props: FieldProps): JSX.Element;
