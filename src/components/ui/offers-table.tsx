'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export interface OfferRow {
  request: any;
  offer: any;
}

interface OffersTableProps {
  rows: OfferRow[];
  loading?: boolean;
  search?: string;
  onSearchChange?: (v: string) => void;
  onPreview?: (request: any) => void;
}

export function OffersTable({
  rows,
  loading,
  search = '',
  onSearchChange,
  onPreview
}: OffersTableProps) {
  const filtered = React.useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      String(r.request?.code || '')
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <div className='flex w-full flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Search by request code...'
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className='max-w-xs'
        />
      </div>
      <div className='bg-background rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[140px]'>Code</TableHead>
              <TableHead className='w-[140px]'>Total</TableHead>
              <TableHead className='w-[140px]'>Transit</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className='w-[80px] text-right'>Preview</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length ? (
              filtered.map(({ request, offer }) => {
                const d =
                  typeof offer?.details === 'string'
                    ? (() => {
                        try {
                          return JSON.parse(offer.details);
                        } catch {
                          return {};
                        }
                      })()
                    : offer?.details || {};
                const total =
                  d.total_price != null
                    ? `${d.total_price} ${d.total_price_currency || d.currency || ''}`
                    : '—';
                const t = Number(d.transit_time);
                const transit = Number.isFinite(t)
                  ? `${t} ${t === 1 ? 'day' : 'days'}`
                  : '—';
                const scope = Array.isArray(d.service_scope)
                  ? d.service_scope.join(', ')
                  : d.service_scope || '—';
                return (
                  <TableRow
                    key={String(request?.id)}
                    className='hover:bg-muted/50'
                  >
                    <TableCell className='font-mono font-semibold'>
                      {request?.code}
                    </TableCell>
                    <TableCell>{total}</TableCell>
                    <TableCell>{transit}</TableCell>
                    <TableCell className='max-w-[360px] truncate'>
                      {scope}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label='Preview'
                        onClick={() => onPreview?.(request)}
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  No offers.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
