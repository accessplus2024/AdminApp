import * as React from 'react';

export interface TableColumn {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
}

export interface TableProps {
  columns: TableColumn[];
  data: Array<Record<string, any>>;
  /** Custom cell renderer; default reads row[col.key]. */
  renderCell?: (row: Record<string, any>, col: TableColumn) => React.ReactNode;
  /** Field used for React keys. Default 'id'. */
  rowKey?: string;
  className?: string;
}

export declare function Table(props: TableProps): JSX.Element;
