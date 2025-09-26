'use client';
import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Filter, Grid, List, ArrowUpDown, X } from 'lucide-react';
import { Icons } from '@/components/icons';

type ViewMode = 'grid' | 'list';

const FREIGHT_LABELS: Record<string, string> = {
  RDF: 'Road',
  SEF: 'Sea',
  ARF: 'Air',
  RAF: 'Rail',
  MMF: 'Multimodal',
  CRX: 'Courier'
};

export interface RequestBrowserProps {
  onSelect: (row: any) => void;
  forwarderId?: string;
}

export function RequestBrowser({ onSelect, forwarderId }: RequestBrowserProps) {
  const [search, setSearch] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [freightFilter, setFreightFilter] = React.useState<string>('');
  const [sort, setSort] = React.useState<
    'newest' | 'offers_desc' | 'budget_desc' | 'budget_asc'
  >('newest');
  const [sorts, setSorts] = React.useState<
    Record<'offers_desc' | 'budget_desc' | 'budget_asc', boolean>
  >({
    offers_desc: false,
    budget_desc: false,
    budget_asc: false
  });
  const [offerCounts, setOfferCounts] = React.useState<Record<string, number>>(
    {}
  );
  const [offeredMap, setOfferedMap] = React.useState<Record<string, boolean>>(
    {}
  );

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('requests').select('*').eq('status', 'pending');
      if (search) q = q.ilike('code', `%${search}%`);
      if (freightFilter) q = q.eq('freight_type', freightFilter);
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setRequests(data);
        const ids = data.map((r: any) => r.id);
        const { data: offers } = await supabase
          .from('offers')
          .select('request_id, forwarder_id')
          .in('request_id', ids);
        const counts: Record<string, number> = {};
        const offered: Record<string, boolean> = {};
        for (const o of offers || []) {
          const rid = String(o.request_id);
          counts[rid] = (counts[rid] || 0) + 1;
          if (forwarderId && String(o.forwarder_id) === String(forwarderId)) {
            offered[rid] = true;
          }
        }
        setOfferCounts(counts);
        setOfferedMap(offered);
      } else {
        setRequests([]);
        setOfferCounts({});
        setOfferedMap({});
      }
    } finally {
      setLoading(false);
    }
  }, [search, freightFilter, forwarderId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = React.useMemo(() => {
    let arr = [...requests];
    // When multiple sorts selected: compute a composite score
    const multi = sorts.budget_asc || sorts.budget_desc || sorts.offers_desc;
    if (multi) {
      // Normalize values and create a weighted score
      // Higher offers and preferred budget direction increase score
      const values = arr.map((r) => {
        const d =
          (typeof r.details === 'string'
            ? (() => {
                try {
                  return JSON.parse(r.details);
                } catch {
                  return {};
                }
              })()
            : r.details) || {};
        const budget = Number(d?.budget ?? NaN);
        const offers = offerCounts[String(r.id)] || 0;
        return { r, budget: Number.isFinite(budget) ? budget : null, offers };
      });
      const budgets = values
        .map((v) => v.budget)
        .filter((v): v is number => v != null);
      const minB = Math.min(...budgets, Number.POSITIVE_INFINITY);
      const maxB = Math.max(...budgets, Number.NEGATIVE_INFINITY);
      const minO = 0;
      const maxO = Math.max(...values.map((v) => v.offers), 1);
      const norm = (v: number, min: number, max: number) => {
        if (
          !Number.isFinite(v) ||
          !Number.isFinite(min) ||
          !Number.isFinite(max) ||
          min === max
        )
          return 0.5;
        return (v - min) / (max - min);
      };
      const wantCheap = sorts.budget_asc && !sorts.budget_desc;
      const wantExpensive = sorts.budget_desc && !sorts.budget_asc;
      arr = values
        .map(({ r, budget, offers }) => {
          const bScoreRaw = budget == null ? 0.5 : norm(budget, minB, maxB);
          // If wantCheap, invert budget score (lower is better → higher score)
          const bScore = wantCheap
            ? 1 - bScoreRaw
            : wantExpensive
              ? bScoreRaw
              : 0.5;
          const oScore = norm(offers, minO, maxO);
          // weights: offers 0.6, budget 0.4 when offers selected; otherwise budget 1.0
          const wOffers = sorts.offers_desc ? 0.6 : 0;
          const wBudget = sorts.offers_desc ? 0.4 : 1.0;
          const score = wOffers * oScore + wBudget * bScore;
          return { r, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ r }) => r);
    } else if (sort === 'offers_desc') {
      arr.sort(
        (a, b) =>
          (offerCounts[String(b.id)] || 0) - (offerCounts[String(a.id)] || 0)
      );
    } else if (sort === 'budget_desc' || sort === 'budget_asc') {
      const dir = sort === 'budget_desc' ? -1 : 1;
      arr.sort((a, b) => {
        const ad = (a.details || {}) as any;
        const bd = (b.details || {}) as any;
        const av = Number(ad?.budget ?? NaN);
        const bv = Number(bd?.budget ?? NaN);
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return (av - bv) * dir;
      });
    } else {
      arr.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
    }
    return arr;
  }, [requests, sort, sorts, offerCounts]);
  const toolbar = (
    <div className='flex flex-wrap items-center gap-2'>
      <Input
        placeholder='Search (code, route, cargo)'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className='min-w-[200px] sm:w-[260px]'
      />
      {/* Filter button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='flex items-center gap-1'
          >
            <Filter className='h-4 w-4 opacity-70' /> Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-56'>
          <DropdownMenuLabel>Freight Type</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setFreightFilter('')}>
            All
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('RDF')}>
            <Icons.road className='mr-2 h-4 w-4' /> Road Freight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('SEF')}>
            <Icons.sea className='mr-2 h-4 w-4' /> Sea Freight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('ARF')}>
            <Icons.air className='mr-2 h-4 w-4' /> Air Freight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('RAF')}>
            <Icons.rail className='mr-2 h-4 w-4' /> Rail Freight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('MMF')}>
            <Icons.multimodal className='mr-2 h-4 w-4' /> Multimodal Freight
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFreightFilter('CRX')}>
            <Icons.courier className='mr-2 h-4 w-4' /> Courier / Express
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Active filter chip */}
      {freightFilter && (
        <Badge variant='secondary' className='flex items-center gap-1'>
          {freightFilter === 'RDF' && <Icons.road className='h-3 w-3' />}
          {freightFilter === 'SEF' && <Icons.sea className='h-3 w-3' />}
          {freightFilter === 'ARF' && <Icons.air className='h-3 w-3' />}
          {freightFilter === 'RAF' && <Icons.rail className='h-3 w-3' />}
          {freightFilter === 'MMF' && <Icons.multimodal className='h-3 w-3' />}
          {freightFilter === 'CRX' && <Icons.courier className='h-3 w-3' />}
          <span>{FREIGHT_LABELS[freightFilter]} Freight</span>
          <button
            className='hover:bg-muted ml-1 rounded p-0.5'
            onClick={() => setFreightFilter('')}
            aria-label='Clear freight filter'
          >
            <X className='h-3 w-3' />
          </button>
        </Badge>
      )}
      {/* Sort button (multi-select) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='flex items-center gap-1'
          >
            <ArrowUpDown className='h-4 w-4 opacity-70' /> Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-56'>
          <DropdownMenuLabel>Primary</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setSort('newest')}>
            Newest
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Multi-select</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() =>
              setSorts((s) => ({ ...s, offers_desc: !s.offers_desc }))
            }
          >
            {sorts.offers_desc ? '✓ ' : ''}Offers (high → low)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              setSorts((s) => ({
                ...s,
                budget_desc: !s.budget_desc,
                budget_asc: s.budget_desc ? s.budget_asc : false
              }))
            }
          >
            {sorts.budget_desc ? '✓ ' : ''}Budget (high → low)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              setSorts((s) => ({
                ...s,
                budget_asc: !s.budget_asc,
                budget_desc: s.budget_asc ? s.budget_desc : false
              }))
            }
          >
            {sorts.budget_asc ? '✓ ' : ''}Budget (low → high)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Active sort chip */}
      {(sort !== 'newest' ||
        sorts.offers_desc ||
        sorts.budget_asc ||
        sorts.budget_desc) && (
        <Badge variant='secondary' className='flex items-center gap-1'>
          <ArrowUpDown className='h-3 w-3' />
          <span className='text-xs'>
            {sort !== 'newest' ? `${sort.replace('_', ' ')}` : 'custom'}
            {(sorts.offers_desc || sorts.budget_asc || sorts.budget_desc) &&
              ' • '}
            {[
              sorts.offers_desc ? 'offers↓' : null,
              sorts.budget_desc ? 'budget↓' : null,
              sorts.budget_asc ? 'budget↑' : null
            ]
              .filter(Boolean)
              .join(', ')}
          </span>
          <button
            className='hover:bg-muted ml-1 rounded p-0.5'
            onClick={() => {
              setSort('newest');
              setSorts({
                offers_desc: false,
                budget_asc: false,
                budget_desc: false
              });
            }}
            aria-label='Clear sorts'
          >
            <X className='h-3 w-3' />
          </button>
        </Badge>
      )}
      <div className='ml-auto flex items-center gap-1'>
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          size='icon'
          onClick={() => setViewMode('list')}
          aria-label='List view'
        >
          <List className='h-4 w-4' />
        </Button>
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size='icon'
          onClick={() => setViewMode('grid')}
          aria-label='Grid view'
        >
          <Grid className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );

  return (
    <div className='flex min-h-[50vh] flex-col gap-3'>
      {toolbar}
      {loading ? (
        <div className='text-muted-foreground text-sm'>Loading...</div>
      ) : sorted.length === 0 ? (
        <div className='text-muted-foreground text-sm'>No requests found.</div>
      ) : viewMode === 'grid' ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {sorted.map((r) => {
            const d =
              (typeof r.details === 'string'
                ? (() => {
                    try {
                      return JSON.parse(r.details);
                    } catch {
                      return {};
                    }
                  })()
                : r.details) || {};
            const budget = d?.budget;
            const origin = d?.origin || d?.airport_origin || '-';
            const destination = d?.destination || d?.airport_destination || '-';
            return (
              <div
                key={r.id}
                className='group bg-card hover:bg-accent/40 relative cursor-pointer rounded-xl border p-4 shadow-sm transition-colors'
                onClick={() => onSelect(r)}
              >
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <div className='text-primary font-mono text-xl font-extrabold tracking-tight'>
                      {r.code}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      {origin} → {destination}
                    </div>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Badge className='border px-1 py-0 text-[10px] capitalize'>
                      {FREIGHT_LABELS[r.freight_type] || r.freight_type}
                    </Badge>
                  </div>
                </div>
                <div className='mt-5 flex items-end justify-between'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='secondary'
                      className='px-1 py-0 text-[11px]'
                    >
                      {offerCounts[String(r.id)] || 0} offers
                    </Badge>
                    {offeredMap[String(r.id)] && (
                      <Badge className='border-indigo-200 bg-indigo-50 px-1 py-0 text-[10px] text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/30 dark:text-indigo-300'>
                        Offered
                      </Badge>
                    )}
                  </div>
                  <div className='text-lg font-semibold'>
                    {budget ? `$${budget}` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='flex flex-col divide-y rounded-lg border'>
          {sorted.map((r) => {
            const d =
              (typeof r.details === 'string'
                ? (() => {
                    try {
                      return JSON.parse(r.details);
                    } catch {
                      return {};
                    }
                  })()
                : r.details) || {};
            const budget = d?.budget;
            const origin = d?.origin || d?.airport_origin || '-';
            const destination = d?.destination || d?.airport_destination || '-';
            return (
              <button
                key={r.id}
                className='hover:bg-accent/40 grid grid-cols-[1fr_auto] items-center gap-3 p-3 text-left'
                onClick={() => onSelect(r)}
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='text-primary font-mono text-base font-bold'>
                      {r.code}
                    </span>
                    <Badge className='border px-1 py-0 text-[10px] capitalize'>
                      {FREIGHT_LABELS[r.freight_type] || r.freight_type}
                    </Badge>
                    <Badge
                      variant='secondary'
                      className='px-1 py-0 text-[10px]'
                    >
                      {offerCounts[String(r.id)] || 0} offers
                    </Badge>
                    {offeredMap[String(r.id)] && (
                      <Badge className='border-indigo-200 bg-indigo-50 px-1 py-0 text-[10px] text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/30 dark:text-indigo-300'>
                        Offered
                      </Badge>
                    )}
                  </div>
                  <div className='text-muted-foreground mt-0.5 truncate text-xs'>
                    {origin} → {destination}
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-lg font-semibold'>
                    {budget ? `$${budget}` : '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
