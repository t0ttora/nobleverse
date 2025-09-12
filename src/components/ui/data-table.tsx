import { useState } from 'react';

interface Column<T extends Record<string, unknown>> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns?: Column<T>[];
  loading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  selectedRows?: string[];
  onSelectRow?: (id: string, checked: boolean) => void;
}

function Ellipsis({ children }: { children: React.ReactNode }) {
  return (
    <span
      className='block max-w-[220px] truncate'
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </span>
  );
}

export function DataTable<T extends { id: string } & Record<string, unknown>>({
  data,
  columns,
  loading,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  selectedRows = [],
  onSelectRow
}: DataTableProps<T>) {
  const [selectAll, setSelectAll] = useState(false);
  if (!columns || columns?.length === 0) {
    if (data.length === 0) return <div>No data</div>;
    columns = Object.keys(data[0] as Record<string, unknown>).map(
      (key) => ({ key, label: key }) as Column<T>
    );
  }

  // Sıralama ikonları için örnek
  const SortIcon = () => (
    <svg
      width='12'
      height='12'
      className='ml-1 inline opacity-60'
      viewBox='0 0 20 20'
    >
      <path
        d='M7 7l3-3 3 3M7 13l3 3 3-3'
        stroke='currentColor'
        strokeWidth='1.5'
        fill='none'
      />
    </svg>
  );

  return (
    <div className='overflow-x-auto rounded-lg border bg-white text-gray-900 dark:bg-[#18181b] dark:text-white'>
      <table className='min-w-full divide-y divide-gray-200 dark:divide-[#232329]'>
        <thead className='bg-gray-50 dark:bg-[#232329]'>
          <tr>
            <th className='w-8 px-2 py-2'>
              <input
                type='checkbox'
                checked={selectAll}
                onChange={(e) => {
                  setSelectAll(e.target.checked);
                  data.forEach((row) =>
                    onSelectRow?.(row.id, e.target.checked)
                  );
                }}
                className='accent-primary'
              />
            </th>
            {columns?.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-left text-xs font-semibold tracking-wider whitespace-nowrap uppercase select-none ${col.width ?? ''}`}
                style={col.width ? { width: col.width } : undefined}
              >
                <span className='flex items-center gap-1'>
                  {col.label}
                  {col.sortable && <SortIcon />}
                </span>
              </th>
            ))}
            <th className='w-8 px-2 py-2'></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={(columns?.length ?? 0) + 2}
                className='py-8 text-center'
              >
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={(columns?.length ?? 0) + 2}
                className='text-muted-foreground py-8 text-center'
              >
                No data found
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                className='group transition-colors hover:bg-gray-100 dark:hover:bg-[#232329]'
              >
                <td className='px-2 py-2'>
                  <input
                    type='checkbox'
                    checked={selectedRows.includes(row.id)}
                    onChange={(e) => onSelectRow?.(row.id, e.target.checked)}
                    className='accent-primary'
                  />
                </td>
                {columns?.map((col) => (
                  <td key={col.key} className='px-3 py-2 whitespace-nowrap'>
                    {col.render
                      ? col.render(row)
                      : (() => {
                          const cell = row[col.key] as unknown;
                          if (typeof cell === 'string') {
                            return cell.length > 30 ? (
                              <Ellipsis>{cell}</Ellipsis>
                            ) : (
                              cell
                            );
                          }
                          return (cell as React.ReactNode) ?? null;
                        })()}
                  </td>
                ))}
                <td className='px-2 py-2 text-right'>
                  <button className='rounded p-1 opacity-60 hover:bg-gray-200 hover:opacity-100 dark:hover:bg-[#232329]'>
                    <svg
                      width='18'
                      height='18'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      viewBox='0 0 24 24'
                    >
                      <circle cx='12' cy='5' r='1.5' />
                      <circle cx='12' cy='12' r='1.5' />
                      <circle cx='12' cy='19' r='1.5' />
                    </svg>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Pagination */}
      <div className='flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs dark:border-[#232329] dark:bg-[#232329]'>
        <div>
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className='ml-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-[#232329] dark:bg-[#232329]'
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div>
          Page {page} of{' '}
          {Number.isFinite(total / pageSize) ? Math.ceil(total / pageSize) : 1}
        </div>
        <div className='flex items-center gap-1'>
          <button
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            disabled={page === 1}
            className='rounded border border-gray-200 bg-white px-2 py-1 disabled:opacity-50 dark:border-[#232329] dark:bg-[#18181b]'
          >
            {'<'}
          </button>
          <button
            onClick={() =>
              onPageChange?.(page * pageSize < total ? page + 1 : page)
            }
            disabled={page * pageSize >= total}
            className='rounded border border-gray-200 bg-white px-2 py-1 disabled:opacity-50 dark:border-[#232329] dark:bg-[#18181b]'
          >
            {'>'}
          </button>
        </div>
      </div>
    </div>
  );
}
