'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = { month: string; shipments: number; revenue: number };

const chartConfig = {
  visitors: {
    label: 'Visitors'
  },
  revenue: { label: 'Revenue', color: 'var(--primary)' },
  shipments: { label: 'Shipments', color: 'var(--primary)' }
} satisfies ChartConfig;

export function AreaGraph() {
  const [data, setData] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const since = new Date(new Date().getFullYear(), 0, 1).toISOString();
        const { data, error } = await supabase
          .from('shipments')
          .select('id, created_at, net_amount_cents')
          .gte('created_at', since);
        if (error) throw error;
        const map = new Map<string, { shipments: number; revenue: number }>();
        for (const s of data || []) {
          const d = new Date(s.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const prev = map.get(key) || { shipments: 0, revenue: 0 };
          const rev =
            typeof s.net_amount_cents === 'number'
              ? s.net_amount_cents / 100
              : 0;
          map.set(key, {
            shipments: prev.shipments + 1,
            revenue: prev.revenue + rev
          });
        }
        const arr = Array.from(map.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => ({
            month: k,
            shipments: v.shipments,
            revenue: Math.round(v.revenue)
          }));
        setData(arr);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Year to Date</CardTitle>
        <CardDescription>Revenue vs Shipments (real data)</CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        {loading || data.length === 0 ? (
          <div className='text-muted-foreground flex h-[250px] w-full items-center justify-center text-sm'>
            {loading ? 'Loading…' : 'No data'}
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className='aspect-auto h-[250px] w-full'
          >
            <AreaChart
              data={data}
              margin={{
                left: 12,
                right: 12
              }}
            >
              <defs>
                <linearGradient id='fillRevenue' x1='0' y1='0' x2='0' y2='1'>
                  <stop
                    offset='5%'
                    stopColor='var(--color-revenue)'
                    stopOpacity={1.0}
                  />
                  <stop
                    offset='95%'
                    stopColor='var(--color-revenue)'
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id='fillShipments' x1='0' y1='0' x2='0' y2='1'>
                  <stop
                    offset='5%'
                    stopColor='var(--color-shipments)'
                    stopOpacity={0.8}
                  />
                  <stop
                    offset='95%'
                    stopColor='var(--color-shipments)'
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='month'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const [y, m] = String(value).split('-');
                  return new Date(Number(y), Number(m) - 1, 1).toLocaleString(
                    'en-US',
                    { month: 'short' }
                  );
                }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator='dot' />}
              />
              <Area
                dataKey='shipments'
                type='natural'
                fill='url(#fillShipments)'
                stroke='var(--color-shipments)'
                stackId='a'
              />
              <Area
                dataKey='revenue'
                type='natural'
                fill='url(#fillRevenue)'
                stroke='var(--color-revenue)'
                stackId='a'
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              Trending up by 5.2% this month{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              Year to date
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
