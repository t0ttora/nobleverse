'use client';
import { LineChart as RLineChart, Line, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

export function KpiLineChartImpl({
  series,
  title,
  heightClass,
  stroke
}: {
  series: Array<{ date: string; value: number }>;
  title: string;
  heightClass?: string;
  stroke?: string;
}) {
  const config = { value: { label: title, color: 'var(--primary)' } } as const;
  const color = stroke || '#0ea5e9';
  return (
    <div className={heightClass || 'h-full w-full'}>
      <ChartContainer config={config as any} className='h-full w-full'>
        {Array.isArray(series) && series.length ? (
          <RLineChart
            data={series}
            margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
          >
            <XAxis
              dataKey='date'
              tick={{ fontSize: 10 }}
              tickFormatter={(d: string) => (d || '').slice(5, 10)}
            />
            <YAxis width={32} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type='monotone'
              dataKey='value'
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </RLineChart>
        ) : (
          <div className='text-muted-foreground flex h-full w-full items-center justify-center text-center text-xs'>
            <div>
              <div className='mb-1 font-medium'>No trend data</div>
              <div>Try changing the period or generating more activity.</div>
            </div>
          </div>
        )}
      </ChartContainer>
    </div>
  );
}
