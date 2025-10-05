import type { DataTableConfig } from '@/config/data-table';
import type { Row, RowData } from '@tanstack/react-table';

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module '@tanstack/react-table' {
  // Type parameters are required by @tanstack/react-table but may not be referenced directly
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type FilterOperator = DataTableConfig['operators'][number];
export type FilterVariant = DataTableConfig['filterVariants'][number];
export type JoinOperator = DataTableConfig['joinOperators'][number];

// Removed unused ExtendedColumnSort/ExtendedColumnFilter generics to satisfy lint

export interface DataTableRowAction<TData extends RowData> {
  row: Row<TData>;
  variant: 'update' | 'delete';
}
/* eslint-enable @typescript-eslint/no-unused-vars */
