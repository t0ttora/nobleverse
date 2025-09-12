'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
  ColumnFiltersState
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Filter
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { OfferCount } from '@/components/ui/offer-count';

// Unified row type to support both Requests and Shipments records
export interface ItemRow {
  id: number | string;
  code: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  // Requests-only
  freight_type?: string;
  user_id?: string;
  details?: Record<string, unknown> | null;
  // Shipments-only
  cargo?: Record<string, unknown> | null;
  net_amount_cents?: number | null;
  incoterm?: string | null;
  owner_id?: string;
}

export const requestColumns: ColumnDef<ItemRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32
  },
  {
    accessorKey: 'code',
    header: ({ column }) => (
      <Button
        variant='ghost'
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Code
        <ArrowUpDown className='ml-2 h-4 w-4' />
      </Button>
    ),
    cell: ({ row }) => (
      <span className='font-mono font-semibold'>{row.getValue('code')}</span>
    )
  },
  {
    accessorKey: 'freight_type',
    header: 'Freight Type',
    cell: ({ row }) => {
      const code = row.getValue('freight_type');
      const map: Record<string, string> = {
        RDF: 'Road Freight',
        SEF: 'Sea Freight',
        ARF: 'Air Freight',
        RAF: 'Rail Freight',
        MMF: 'Multimodal Freight',
        CRX: 'Courier / Express Shipping'
      };
      const codeStr = typeof code === 'string' ? code : '';
      return <span>{map[codeStr] || codeStr}</span>;
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const value = row.original.status;
      let color = '';
      switch (value) {
        // Requests statuses
        case 'pending':
          color =
            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
          break;
        case 'accepted':
          color =
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
          break;
        case 'in_shipment':
          color =
            'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800';
          break;
        case 'completed':
          color =
            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
          break;
        case 'archived':
          color =
            'bg-gray-200 dark:bg-gray-800/40 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
          break;
        // Shipments statuses
        case 'created':
          color =
            'bg-gray-100 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
          break;
        case 'in_transit':
          color =
            'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800';
          break;
        case 'delivered':
          color =
            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
          break;
        case 'disputed':
          color =
            'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
          break;
        case 'cancelled':
          color =
            'bg-gray-200 dark:bg-gray-800/40 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
          break;
        default:
          color =
            'bg-gray-100 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
      }
      return <Badge className={`border capitalize ${color}`}>{value}</Badge>;
    }
  },
  {
    accessorKey: 'details.cargo_type',
    header: 'Cargo Type',
    cell: ({ row }) => {
      const details = row.original.details as
        | { cargo_type?: string }
        | null
        | undefined;
      const cargo = row.original.cargo as
        | { cargo_type?: string }
        | null
        | undefined;
      return <span>{cargo?.cargo_type ?? details?.cargo_type ?? '-'}</span>;
    }
  },
  {
    accessorKey: 'details.origin',
    header: 'Origin',
    cell: ({ row }) => {
      const details = row.original.details as
        | { origin?: string }
        | null
        | undefined;
      const cargo = row.original.cargo as
        | { origin?: string }
        | null
        | undefined;
      return <span>{cargo?.origin ?? details?.origin ?? '-'}</span>;
    }
  },
  {
    accessorKey: 'details.destination',
    header: 'Destination',
    cell: ({ row }) => {
      const details = row.original.details as
        | { destination?: string }
        | null
        | undefined;
      const cargo = row.original.cargo as
        | { destination?: string }
        | null
        | undefined;
      return <span>{cargo?.destination ?? details?.destination ?? '-'}</span>;
    }
  },
  {
    accessorKey: 'details.budget',
    header: 'Budget',
    cell: ({ row }) => {
      const details = row.original.details as
        | { budget?: number }
        | null
        | undefined;
      const cargo = row.original.cargo as
        | { budget?: number }
        | null
        | undefined;
      const budget = cargo?.budget ?? details?.budget;
      return <span>{budget !== undefined ? `$${budget}` : '-'}</span>;
    }
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const request = row.original;
      return (
        <div className='flex justify-end'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Open menu</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => void navigator.clipboard.writeText(request.code)}
              >
                Copy request code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>View details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }
  }
];

// Additional columns tailored for Shipments (extends request columns with Incoterm and Amount)
export const shipmentColumns: ColumnDef<ItemRow>[] = [
  ...requestColumns.filter((c) => {
    // keep: select, code, status, cargo/destination/origin; drop freight_type for shipments
    const id = (c as any).id || (c as any).accessorKey;
    return id !== 'freight_type';
  }),
  {
    accessorKey: 'incoterm',
    header: 'Incoterm',
    cell: ({ row }) => <span>{row.original.incoterm || '-'}</span>
  },
  {
    accessorKey: 'net_amount_cents',
    header: 'Net Amount',
    cell: ({ row }) => {
      const cents = row.original.net_amount_cents ?? null;
      return (
        <span>
          {typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : '-'}
        </span>
      );
    }
  }
];

interface ShipmentsTableProps {
  data: ItemRow[];
  columnsProp?: ColumnDef<ItemRow>[];
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  onRowClick?: (req: ItemRow) => void;
  offerCounts?: Record<string, number>;
  offeredMap?: Record<string, boolean>;
  negotiationCounts?: Record<string, number>;
  // avatar stacks removed
  viewMode?: 'table' | 'grid';
  onViewModeChange?: (mode: 'table' | 'grid') => void;
  hasOffersOnly?: boolean;
  onHasOffersOnlyChange?: (v: boolean) => void;
  // forwarder UX: hide requests that already have my offer
  hideOffered?: boolean;
  onHideOfferedChange?: (v: boolean) => void;
  // Which dataset are we showing? Controls default columns & labels
  variant?: 'requests' | 'shipments';
}

export function ShipmentsTable({
  data,
  columnsProp,
  loading,
  search = '',
  onSearchChange,
  onRowClick,
  offerCounts,
  offeredMap,
  negotiationCounts,
  // avatar stacks removed
  viewMode = 'table',
  onViewModeChange,
  hasOffersOnly = false,
  onHasOffersOnlyChange,
  hideOffered,
  onHideOfferedChange,
  variant = 'requests'
}: ShipmentsTableProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  // Varsayılan satır sayısı 20
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 25
  });

  // updated_at alanına göre (en yeni en üstte) sıralama
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const ac = offerCounts ? offerCounts[String(a.id)] || 0 : 0;
      const bc = offerCounts ? offerCounts[String(b.id)] || 0 : 0;
      if (ac !== bc) return bc - ac; // prioritize with offers
      const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [data, offerCounts]);

  const filteredData = React.useMemo(() => {
    if (!hasOffersOnly || !offerCounts) return sortedData;
    return sortedData.filter((r) => (offerCounts[String(r.id)] || 0) > 0);
  }, [sortedData, hasOffersOnly, offerCounts]);

  // When toggling Has Offers, jump back to page 1 to avoid empty pages
  React.useEffect(() => {
    // only act when prop is explicitly boolean
    if (typeof hasOffersOnly === 'boolean') {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }
  }, [hasOffersOnly]);

  const columnsToUse: ColumnDef<ItemRow>[] = React.useMemo(() => {
    if (columnsProp) return columnsProp;
    return variant === 'shipments' ? shipmentColumns : requestColumns;
  }, [columnsProp, variant]);

  const table = useReactTable({
    data: filteredData,
    columns: columnsToUse,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination
    },
    getPaginationRowModel: getPaginationRowModel()
  });

  // On mobile table view, only show code, status and actions; hide others.
  // Reset to all visible when not in mobile table mode.
  React.useEffect(() => {
    const isMobileTable = isMobile && viewMode === 'table';
    if (isMobileTable) {
      const allowed = new Set(['code', 'status', 'actions']);
      const next: VisibilityState = {};
      table.getAllLeafColumns().forEach((col) => {
        next[col.id] = allowed.has(col.id);
      });
      setColumnVisibility(next);
    } else {
      const next: VisibilityState = {};
      table.getAllLeafColumns().forEach((col) => {
        next[col.id] = true;
      });
      setColumnVisibility(next);
    }
  }, [isMobile, viewMode, table, setColumnVisibility]);

  const router = useRouter();
  // On mobile, default to grid but respect explicit table selection
  const effectiveViewMode: 'table' | 'grid' = isMobile
    ? viewMode === 'table'
      ? 'table'
      : 'grid'
    : viewMode;

  return (
    <div className='relative flex h-screen w-full flex-col'>
      {/* Arama ve filtreleme barı */}
      <div className='bg-background sticky top-0 z-20 flex items-center gap-2 px-2 py-4'>
        <Input
          placeholder='Search code...'
          value={search}
          onChange={(event) =>
            onSearchChange ? onSearchChange(event.target.value) : undefined
          }
          className={isMobile ? 'flex-1' : 'max-w-sm'}
        />
        {/* Compute status options based on variant */}
        {(() => null)()}
        {isMobile ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' size='icon' aria-label='Filters'>
                <Filter className='h-4 w-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='end' sideOffset={8} className='w-72'>
              <div className='flex flex-col gap-3'>
                <div>
                  <div className='mb-1 text-xs font-semibold'>Status</div>
                  <div className='grid grid-cols-2 gap-2'>
                    {(variant === 'shipments'
                      ? [
                          { label: 'All', value: '' },
                          { label: 'Created', value: 'created' },
                          { label: 'In transit', value: 'in_transit' },
                          { label: 'Delivered', value: 'delivered' },
                          { label: 'Disputed', value: 'disputed' },
                          { label: 'Cancelled', value: 'cancelled' }
                        ]
                      : [
                          { label: 'All', value: '' },
                          { label: 'Pending', value: 'pending' },
                          { label: 'Accepted', value: 'accepted' },
                          { label: 'In shipment', value: 'in_shipment' },
                          { label: 'Completed', value: 'completed' },
                          { label: 'Cancelled', value: 'cancelled' },
                          { label: 'Archived', value: 'archived' }
                        ]
                    ).map((opt) => (
                      <Button
                        key={opt.label}
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          table.getColumn('status')?.setFilterValue(opt.value)
                        }
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {offerCounts && onHasOffersOnlyChange && (
                  <div className='flex items-center justify-between'>
                    <div className='text-xs'>Has offers</div>
                    <Button
                      size='sm'
                      variant={hasOffersOnly ? 'default' : 'outline'}
                      onClick={() => onHasOffersOnlyChange(!hasOffersOnly)}
                    >
                      {hasOffersOnly ? 'On' : 'Off'}
                    </Button>
                  </div>
                )}
                {offeredMap &&
                  Object.keys(offeredMap).length > 0 &&
                  onHideOfferedChange && (
                    <div className='flex items-center justify-between'>
                      <div className='text-xs'>Hide already offered</div>
                      <Button
                        size='sm'
                        variant={hideOffered ? 'default' : 'outline'}
                        onClick={() => onHideOfferedChange(!hideOffered)}
                      >
                        {hideOffered ? 'On' : 'Off'}
                      </Button>
                    </div>
                  )}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <>
            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='min-w-[120px] text-xs'
                >
                  {(function () {
                    const v =
                      (table.getColumn('status')?.getFilterValue() as string) ||
                      '';
                    if (!v) return 'All Statuses';
                    const mapReq: Record<string, string> = {
                      pending: 'Pending',
                      accepted: 'Accepted',
                      in_shipment: 'In shipment',
                      completed: 'Completed',
                      cancelled: 'Cancelled',
                      archived: 'Archived'
                    };
                    const mapShip: Record<string, string> = {
                      created: 'Created',
                      in_transit: 'In transit',
                      delivered: 'Delivered',
                      disputed: 'Disputed',
                      cancelled: 'Cancelled'
                    };
                    return (
                      (variant === 'shipments' ? mapShip[v] : mapReq[v]) ||
                      v.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())
                    );
                  })()}
                  <ChevronDown className='ml-2 h-3 w-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                {(variant === 'shipments'
                  ? [
                      { label: 'All Statuses', value: '' },
                      { label: 'Created', value: 'created' },
                      { label: 'In transit', value: 'in_transit' },
                      { label: 'Delivered', value: 'delivered' },
                      { label: 'Disputed', value: 'disputed' },
                      { label: 'Cancelled', value: 'cancelled' }
                    ]
                  : [
                      { label: 'All Statuses', value: '' },
                      { label: 'Pending', value: 'pending' },
                      { label: 'Accepted', value: 'accepted' },
                      { label: 'In shipment', value: 'in_shipment' },
                      { label: 'Completed', value: 'completed' },
                      { label: 'Cancelled', value: 'cancelled' },
                      { label: 'Archived', value: 'archived' }
                    ]
                ).map((opt) => (
                  <DropdownMenuItem
                    key={opt.label}
                    onClick={() =>
                      table.getColumn('status')?.setFilterValue(opt.value)
                    }
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {offerCounts && onHasOffersOnlyChange && (
              <Button
                size='sm'
                variant={hasOffersOnly ? 'default' : 'outline'}
                className='text-xs'
                onClick={() => onHasOffersOnlyChange(!hasOffersOnly)}
              >
                Has offers
              </Button>
            )}
            {offeredMap &&
              Object.keys(offeredMap).length > 0 &&
              onHideOfferedChange && (
                <Button
                  size='sm'
                  variant={hideOffered ? 'default' : 'outline'}
                  className='text-xs'
                  onClick={() => onHideOfferedChange(!hideOffered)}
                >
                  Hide already offered
                </Button>
              )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' className='ml-auto'>
                  Columns <ChevronDown className='ml-2 h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className='capitalize'
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* View toggle */}
            {onViewModeChange && (
              <div className='flex items-center gap-2'>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onViewModeChange('table')}
                >
                  Rows
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onViewModeChange('grid')}
                >
                  Grid
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Scrollable içerik: pagination hariç tüm alanı kapla */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        <div
          className={`bg-background flex-1 overflow-y-auto rounded-md ${isMobile ? 'pb-20' : ''}`}
          style={{ height: '100%' }}
        >
          {effectiveViewMode === 'grid' ? (
            <div className='grid grid-cols-1 gap-3 p-2 sm:grid-cols-2 lg:grid-cols-3'>
              {filteredData.map((row) => {
                const details = (row.details || {}) as any;
                const cargoType = details?.cargo_type || '-';
                const budget = details?.budget;
                const ownerName =
                  (row as any).owner_company_name ||
                  (row as any).owner_username ||
                  '';
                const ownerAvatar =
                  (row as any).owner_avatar_url || '/logomark.svg';
                // Match table badge colors (with dark mode variants)
                const status = row.status as string;
                let badgeColor = '';
                switch (status) {
                  case 'pending':
                    badgeColor =
                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
                    break;
                  case 'accepted':
                    badgeColor =
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                    break;
                  case 'in_shipment':
                    badgeColor =
                      'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800';
                    break;
                  case 'completed':
                    badgeColor =
                      'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
                    break;
                  case 'archived':
                    badgeColor =
                      'bg-gray-200 dark:bg-gray-800/40 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
                    break;
                  default:
                    badgeColor =
                      'bg-gray-100 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
                }
                return (
                  <div
                    key={row.id}
                    className='group bg-card hover:bg-muted/60 relative cursor-pointer overflow-hidden rounded-xl border p-4 shadow-sm transition-colors hover:border-neutral-300 dark:hover:border-neutral-700'
                    onClick={() => onRowClick?.(row)}
                  >
                    {/* Top: left code + type, right status */}
                    <div className='grid grid-cols-[1fr_auto] items-start gap-3'>
                      <div className='min-w-0'>
                        <div className='text-primary font-mono text-2xl leading-tight font-extrabold tracking-tight'>
                          {row.code}
                        </div>
                        <div className='text-muted-foreground mt-0.5 flex items-center gap-2 text-[12px]'>
                          <span>{cargoType}</span>
                          {offeredMap && offeredMap[String(row.id)] ? (
                            <Badge className='border-indigo-200 bg-indigo-50 px-1 py-0 text-[10px] text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/30 dark:text-indigo-300'>
                              Offered
                            </Badge>
                          ) : null}
                          {negotiationCounts &&
                          (negotiationCounts[String(row.id)] || 0) > 0 ? (
                            <Badge className='border-amber-200 bg-amber-50 px-1 py-0 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300'>
                              Negotiation
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className='flex items-start gap-2'>
                        {offerCounts && (
                          <div className='flex items-center gap-1.5'>
                            <OfferCount
                              count={offerCounts[String(row.id)] || 0}
                              labeled
                            />
                          </div>
                        )}
                        <Badge
                          className={`border whitespace-nowrap capitalize ${badgeColor}`}
                        >
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                    {/* Bottom: left owner avatar+name, right budget */}
                    <div className='mt-6 flex items-end justify-between'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <img
                          src={ownerAvatar}
                          alt=''
                          className='h-7 w-7 rounded-full border'
                        />
                        <div
                          className='text-foreground/80 max-w-[140px] truncate text-xs'
                          title={String(ownerName)}
                        >
                          {ownerName}
                        </div>
                      </div>
                      <div className='text-xl font-semibold tracking-tight'>
                        {budget !== undefined && budget !== null
                          ? `$${budget}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={
                isMobile ? 'flex w-full justify-center px-2' : undefined
              }
            >
              <div className={isMobile ? 'w-full max-w-[420px]' : undefined}>
                <Table className='min-h-full'>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={
                              header.id === 'actions'
                                ? 'bg-background sticky right-0 z-10'
                                : ''
                            }
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={columnsToUse.length}
                          className='h-24 text-center'
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => {
                        const shipmentCode = row.original.code;
                        return (
                          <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && 'selected'}
                            className='group cursor-pointer'
                            onClick={() => {
                              if (onRowClick) onRowClick(row.original);
                              else
                                void router.push(`/shipments/${shipmentCode}`);
                            }}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className={
                                  cell.column.id === 'actions'
                                    ? 'group-hover:bg-muted sticky right-0 z-10 bg-inherit transition-colors'
                                    : 'group-hover:bg-muted transition-colors'
                                }
                                onClick={(e) => {
                                  // Actions kolonunda tıklama event'ini satıra iletme
                                  if (cell.column.id === 'actions') {
                                    e.stopPropagation();
                                  }
                                }}
                              >
                                <div className='flex items-center gap-2'>
                                  {cell.column.id === 'code' && offerCounts ? (
                                    <div className='flex items-center gap-1.5'>
                                      <OfferCount
                                        count={
                                          offerCounts[
                                            String(row.original.id)
                                          ] || 0
                                        }
                                        labeled
                                      />
                                    </div>
                                  ) : null}
                                  {cell.column.id === 'code' &&
                                  offeredMap &&
                                  offeredMap[String(row.original.id)] ? (
                                    <Badge className='border-indigo-200 bg-indigo-50 px-1 py-0 text-[10px] text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/30 dark:text-indigo-300'>
                                      Offered
                                    </Badge>
                                  ) : null}
                                  {cell.column.id === 'code' &&
                                  negotiationCounts &&
                                  (negotiationCounts[String(row.original.id)] ||
                                    0) > 0 ? (
                                    <Badge className='border-amber-200 bg-amber-50 px-1 py-0 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300'>
                                      Negotiation
                                    </Badge>
                                  ) : null}
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columnsToUse.length}
                          className='h-24 text-center'
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        {/* Pagination */}
        {isMobile ? (
          <div
            className={[
              'fixed flex items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg',
              'bg-[rgba(255,255,255,0.95)] backdrop-blur-md dark:bg-[rgba(24,24,27,0.95)]',
              'border-muted/30 dark:border-zinc-800',
              'z-20'
            ].join(' ')}
            style={{
              bottom: 'var(--fab-bottom, 24px)',
              right: 'calc(var(--fab-space, 80px))'
            }}
          >
            <Button
              variant='outline'
              size='icon'
              className='rounded-full'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <span className='px-1 text-xs'>
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant='outline'
              size='icon'
              className='rounded-full'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        ) : (
          <div className='pointer-events-none'>
            <div
              className='flex w-full flex-col items-center'
              style={{ position: 'fixed', left: 0, bottom: 24, zIndex: 2 }}
            >
              <div
                className={[
                  'flex flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row sm:gap-4',
                  'bg-[rgba(255,255,255,0.95)] dark:bg-[rgba(24,24,27,0.95)]',
                  'border-muted/30 pointer-events-auto w-[95vw] max-w-2xl rounded-xl border shadow-lg backdrop-blur-md dark:border-zinc-800'
                ].join(' ')}
                style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}
              >
                <div className='text-muted-foreground min-w-[120px] text-center text-xs sm:text-left'>
                  {
                    table
                      .getPaginationRowModel()
                      .rows.filter((row) => row.getIsSelected()).length
                  }{' '}
                  of {table.getPaginationRowModel().rows.length} rows selected
                </div>
                <div className='flex items-center justify-center'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='outline'
                        size='sm'
                        className='hover:bg-accent/60 min-w-[110px] rounded-full text-xs shadow-sm transition-colors'
                      >
                        Rows: {table.getState().pagination.pageSize}
                        <ChevronDown className='ml-2 h-3 w-3' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='center'>
                      {[25, 50, 100].map((size) => (
                        <DropdownMenuItem
                          key={size}
                          onClick={() => table.setPageSize(size)}
                        >
                          {size}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className='flex min-w-[180px] items-center justify-end gap-2'>
                  <Button
                    variant='outline'
                    size='icon'
                    className='hover:bg-accent/60 rounded-full shadow-sm transition-colors'
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronsLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='icon'
                    className='hover:bg-accent/60 rounded-full shadow-sm transition-colors'
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <span className='px-2 text-xs'>
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {table.getPageCount()}
                  </span>
                  <Button
                    variant='outline'
                    size='icon'
                    className='hover:bg-accent/60 rounded-full shadow-sm transition-colors'
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='icon'
                    className='hover:bg-accent/60 rounded-full shadow-sm transition-colors'
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronsRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Pagination kaldırıldı */}
    </div>
  );
}
