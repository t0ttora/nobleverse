'use client';
import * as React from 'react';
import { Label, Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

type Slice = { name: string; value: number; fill?: string };

export function PieGraphImpl({
  data,
  total
}: {
  data: Slice[];
  total: number;
}) {
  return (
    <ChartContainer
      config={{ value: { label: 'Shipments' } }}
      className='mx-auto aspect-square h-[250px]'
    >
      <PieChart>
        <defs>
          {[0, 1, 2, 3].map((i) => (
            <linearGradient
              key={i}
              id={`fillSlice${i}`}
              x1='0'
              y1='0'
              x2='0'
              y2='1'
            >
              <stop
                offset='0%'
                stopColor='var(--primary)'
                stopOpacity={1 - i * 0.15}
              />
              <stop
                offset='100%'
                stopColor='var(--primary)'
                stopOpacity={0.8 - i * 0.15}
              />
            </linearGradient>
          ))}
        </defs>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey='value'
          nameKey='name'
          innerRadius={60}
          strokeWidth={2}
          stroke='var(--background)'
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor='middle'
                    dominantBaseline='middle'
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className='fill-foreground text-3xl font-bold'
                    >
                      {total.toLocaleString()}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 24}
                      className='fill-muted-foreground text-sm'
                    >
                      Total Shipments
                    </tspan>
                  </text>
                );
              }
              return null;
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
