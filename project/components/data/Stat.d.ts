import * as React from 'react';

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Leading icon node, shown in an azul tile. */
  icon?: React.ReactNode;
  /** Change indicator text, e.g. "+12%". */
  delta?: React.ReactNode;
  /** Direction of the delta arrow + colour. */
  deltaDir?: 'up' | 'down';
  className?: string;
}

export declare function Stat(props: StatProps): JSX.Element;
