'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';

interface Kpi {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'flat';
  note?: string;
  deltaPct?: number;
  onClick?: () => void;
  headline?: string;
}

export function KPICards({
  items,
  loading
}: {
  items: Kpi[];
  loading?: boolean;
}) {
  function isCurrencyLabel(label: string) {
    const l = label.toLowerCase();
    return (
      l.includes('spend') ||
      l.includes('revenue') ||
      l.includes('amount') ||
      l.includes('cost') ||
      l.includes('total')
    );
  }
  function formatCurrency(v: number) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(v);
    } catch {
      return `$${v.toLocaleString()}`;
    }
  }
  function renderValue(label: string, value: string | number) {
    if (typeof value === 'string') {
      // Don't double-prefix if already formatted
      if (value.trim().startsWith('$') || /usd/i.test(value)) return value;
      if (isCurrencyLabel(label)) return `${value} USD`;
      return value;
    }
    if (typeof value === 'number' && isCurrencyLabel(label)) {
      return (
        <span className='flex items-baseline gap-2'>
          <span>{formatCurrency(value)}</span>
          <span className='text-muted-foreground text-xs'>USD</span>
        </span>
      );
    }
    return String(value);
  }
  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => (
            <Card className='@container/card' key={i}>
              <CardHeader>
                <CardDescription>
                  <span className='bg-muted inline-block h-4 w-24 animate-pulse rounded' />
                </CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  <span className='bg-muted inline-block h-7 w-20 animate-pulse rounded' />
                </CardTitle>
                <CardAction>
                  <span className='bg-muted inline-block h-6 w-16 animate-pulse rounded' />
                </CardAction>
              </CardHeader>
              <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                <div className='flex w-full flex-col gap-2'>
                  <span className='bg-muted inline-block h-4 w-32 animate-pulse rounded' />
                  <span className='bg-muted inline-block h-3 w-48 animate-pulse rounded' />
                </div>
              </CardFooter>
            </Card>
          ))
        : items.map((kpi, i) => (
            <Card
              className={`@container/card ${kpi.onClick ? 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer' : ''}`}
              key={i}
              onClick={() => kpi.onClick?.()}
            >
              <CardHeader>
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  {renderValue(kpi.label, kpi.value)}
                </CardTitle>
                <CardAction>
                  <Badge variant='outline'>
                    {kpi.trend === 'up' && <IconTrendingUp />}
                    {kpi.trend === 'down' && <IconTrendingDown />}
                    {typeof kpi.deltaPct === 'number'
                      ? `${kpi.deltaPct >= 0 ? '+' : ''}${kpi.deltaPct.toFixed(1)}%`
                      : kpi.trend === 'up'
                        ? '+12.5%'
                        : kpi.trend === 'down'
                          ? '-8%'
                          : '0%'}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                <div className='line-clamp-2 flex items-center gap-2 font-medium'>
                  {kpi.headline ? (
                    <span className='truncate'>{kpi.headline}</span>
                  ) : (
                    <>
                      {/* Short copy for tight cards */}
                      <span className='truncate @[0px]/card:inline @[300px]/card:hidden'>
                        {kpi.trend === 'up' && 'Up'}
                        {kpi.trend === 'down' && 'Down'}
                        {kpi.trend === 'flat' && 'Stable'}
                        {typeof kpi.deltaPct === 'number' &&
                          ` ${kpi.deltaPct >= 0 ? '+' : ''}${kpi.deltaPct.toFixed(1)}%`}
                      </span>
                      {/* Rich copy for wider cards */}
                      <span className='hidden truncate @[300px]/card:inline'>
                        {(() => {
                          const pct =
                            typeof kpi.deltaPct === 'number'
                              ? `${kpi.deltaPct >= 0 ? '+' : ''}${kpi.deltaPct.toFixed(1)}%`
                              : null;
                          if (kpi.trend === 'up')
                            return `${kpi.label} improving ${pct ?? ''}`.trim();
                          if (kpi.trend === 'down')
                            return `${kpi.label} decreased ${pct ?? ''}`.trim();
                          return `${kpi.label} stable ${pct ?? ''}`.trim();
                        })()}
                      </span>
                      {kpi.trend === 'up' && (
                        <IconTrendingUp className='size-4 shrink-0' />
                      )}
                      {kpi.trend === 'down' && (
                        <IconTrendingDown className='size-4 shrink-0' />
                      )}
                    </>
                  )}
                </div>
                {kpi.note && (
                  <div className='text-muted-foreground'>{kpi.note}</div>
                )}
              </CardFooter>
            </Card>
          ))}
    </div>
  );
}
