import * as React from 'react';

export interface DialogProps {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called on scrim click / dismiss. */
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer action row (e.g. Cancel / Confirm buttons). */
  footer?: React.ReactNode;
  /** Max width in px. Default 460. */
  width?: number;
  children?: React.ReactNode;
}

export declare function Dialog(props: DialogProps): JSX.Element | null;
