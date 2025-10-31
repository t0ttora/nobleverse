'use client';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

export function AreaGraphImpl({
  data
}: {
  data: Array<{ month: string; shipments: number; revenue: number }>;
}) {
  const chartConfig = {
    revenue: { label: 'Revenue', color: 'var(--primary)' },
    shipments: { label: 'Shipments', color: 'var(--primary)' }
  } as const;
  return (
    <ChartContainer
      config={chartConfig as any}
      className='aspect-auto h-[250px] w-full'
    >
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
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
  );
}
