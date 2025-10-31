'use client';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

export function BarGraphImpl({
  data,
  activeKey,
  config
}: {
  data: Array<{ date: string; shipments: number; revenue: number }>;
  activeKey: 'shipments' | 'revenue';
  config: Record<string, { label: string; color: string }>;
}) {
  return (
    <ChartContainer
      config={config as any}
      className='aspect-auto h-[250px] w-full'
    >
      <BarChart data={data} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id='fillBar' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='var(--primary)' stopOpacity={0.8} />
            <stop offset='100%' stopColor='var(--primary)' stopOpacity={0.2} />
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
            const date = new Date(value as string);
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
          }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--primary)', opacity: 0.1 } as any}
          content={
            <ChartTooltipContent
              className='w-[180px]'
              nameKey='views'
              labelFormatter={(value) => {
                return new Date(String(value)).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              }}
            />
          }
        />
        <Bar dataKey={activeKey} fill='url(#fillBar)' radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
