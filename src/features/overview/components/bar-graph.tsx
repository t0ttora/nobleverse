'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { supabase } from '@/lib/supabaseClient';

export const description = 'Shipments and revenue (last 30 days)';

const chartConfig = {
  shipments: {
    label: 'Shipments',
    color: 'var(--primary)'
  },
  revenue: {
    label: 'Revenue (USD)',
    color: 'var(--primary)'
  }
} satisfies ChartConfig;

export function BarGraph() {
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>('shipments');

  type Row = { date: string; shipments: number; revenue: number };
  const [chartData, setChartData] = React.useState<Row[]>([]);
  const total = React.useMemo(() => {
    return {
      shipments: chartData.reduce(
        (acc, curr) => acc + (curr.shipments || 0),
        0
      ),
      revenue: chartData.reduce((acc, curr) => acc + (curr.revenue || 0), 0)
    };
  }, [chartData]);

  const [isClient, setIsClient] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data, error } = await supabase
          .from('shipments')
          .select('id, created_at, net_amount_cents')
          .gte('created_at', since)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const map = new Map<string, { shipments: number; revenue: number }>();
        for (const s of data || []) {
          const day = new Date(s.created_at).toISOString().slice(0, 10);
          const prev = map.get(day) || { shipments: 0, revenue: 0 };
          const rev =
            typeof s.net_amount_cents === 'number'
              ? s.net_amount_cents / 100
              : 0;
          map.set(day, {
            shipments: prev.shipments + 1,
            revenue: prev.revenue + rev
          });
        }
        const arr: Row[] = Array.from(map.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, v]) => ({
            date,
            shipments: v.shipments,
            revenue: Math.round(v.revenue)
          }));
        setChartData(arr);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
        setChartData([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <Card className='@container/card !pt-3'>
      <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
        <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
          <CardTitle>Overview — Shipments & Revenue</CardTitle>
          <CardDescription>
            <span className='hidden @[540px]/card:block'>
              Last 30 days (real data)
            </span>
            <span className='@[540px]/card:hidden'>Last 30 days</span>
          </CardDescription>
        </div>
        <div className='flex'>
          {(Object.keys(chartConfig) as Array<keyof typeof chartConfig>).map(
            (chart) => {
              const key = chart as 'shipments' | 'revenue';
              if (total[key] === 0) return null;
              return (
                <button
                  key={chart}
                  data-active={activeChart === chart}
                  className='data-[active=true]:bg-primary/5 hover:bg-primary/5 relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors duration-200 even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6'
                  onClick={() => setActiveChart(chart)}
                >
                  <span className='text-muted-foreground text-xs'>
                    {chartConfig[chart].label}
                  </span>
                  <span className='text-lg leading-none font-bold sm:text-3xl'>
                    {total[key].toLocaleString()}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        {loading ? (
          <div className='text-muted-foreground flex h-[250px] w-full items-center justify-center text-sm'>
            Loading…
          </div>
        ) : chartData.length === 0 ? (
          <div className='text-muted-foreground flex h-[250px] w-full items-center justify-center text-sm'>
            No shipments in the last 30 days.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className='aspect-auto h-[250px] w-full'
          >
            <BarChart
              data={chartData}
              margin={{
                left: 12,
                right: 12
              }}
            >
              <defs>
                <linearGradient id='fillBar' x1='0' y1='0' x2='0' y2='1'>
                  <stop
                    offset='0%'
                    stopColor='var(--primary)'
                    stopOpacity={0.8}
                  />
                  <stop
                    offset='100%'
                    stopColor='var(--primary)'
                    stopOpacity={0.2}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });
                }}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
                content={
                  <ChartTooltipContent
                    className='w-[180px]'
                    nameKey='views'
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    }}
                  />
                }
              />
              <Bar
                dataKey={activeChart}
                fill='url(#fillBar)'
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
