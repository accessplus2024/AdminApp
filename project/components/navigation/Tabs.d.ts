import * as React from 'react';

export interface TabItem {
  value: string;
  label: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  /** Currently-selected value. */
  value: string;
  onChange?: (value: string) => void;
  /** `solid` = segmented pill group, `line` = underline tabs. */
  variant?: 'solid' | 'line';
  className?: string;
}

export declare function Tabs(props: TabsProps): JSX.Element;
