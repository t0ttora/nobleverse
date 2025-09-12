import { createParser } from 'nuqs';
import type { SortingState } from '@tanstack/react-table';
import type { DataTableConfig } from '@/config/data-table';

// Minimal parser for sorting state via query string like: id.asc,id2.desc
export function getSortingStateParser<T>(columnIds: Set<string>) {
  return createParser<SortingState>({
    parse(value) {
      if (!value) return [];
      return value
        .split(',')
        .map((token) => {
          const [id, dir] = token.split('.');
          if (!id || (columnIds.size && !columnIds.has(id))) return null;
          return { id, desc: dir === 'desc' } as { id: string; desc: boolean };
        })
        .filter(Boolean) as SortingState;
    },
    serialize(state) {
      return (state ?? [])
        .map((s) => `${s.id}.${s.desc ? 'desc' : 'asc'}`)
        .join(',');
    },
    eq(a, b) {
      if (a === b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || !!a[i].desc !== !!b[i].desc) return false;
      }
      return true;
    }
  });
}

// Shared filter schema used across table utilities
export type FilterItemValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null
  | [number, number]
  | [Date, Date]
  | Date;

export interface FilterItemSchema {
  value: FilterItemValue;
  operator: DataTableConfig['operators'][number];
}
