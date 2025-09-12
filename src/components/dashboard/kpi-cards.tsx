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
  value: string;
  trend: 'up' | 'down' | 'flat';
  note?: string;
}

export function KPICards({ items }: { items: Kpi[] }) {
  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
      {items.map((kpi, i) => (
        <Card className='@container/card' key={i}>
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
              {kpi.value}
            </CardTitle>
            <CardAction>
              <Badge variant='outline'>
                {kpi.trend === 'up' && <IconTrendingUp />}
                {kpi.trend === 'down' && <IconTrendingDown />}
                {kpi.trend === 'up'
                  ? '+12.5%'
                  : kpi.trend === 'down'
                    ? '-8%'
                    : '0%'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1.5 text-sm'>
            <div className='line-clamp-1 flex gap-2 font-medium'>
              {kpi.trend === 'up' && (
                <>
                  Trending up this period <IconTrendingUp className='size-4' />
                </>
              )}
              {kpi.trend === 'down' && (
                <>
                  Down this period <IconTrendingDown className='size-4' />
                </>
              )}
              {kpi.trend === 'flat' && <>Stable this period</>}
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
