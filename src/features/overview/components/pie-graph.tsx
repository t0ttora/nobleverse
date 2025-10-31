'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ChartConfig } from '@/components/ui/chart';
import { supabase } from '@/lib/supabaseClient';

type Slice = { name: string; value: number; fill?: string };

const chartConfig = {
  value: { label: 'Shipments' }
} satisfies ChartConfig;

export function PieGraph() {
  const [data, setData] = React.useState<Slice[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const since = new Date(Date.now() - 90 * 86400000).toISOString();
        const { data, error } = await supabase
          .from('shipments')
          .select('forwarder_id')
          .gte('created_at', since);
        if (error) throw error;
        const counts = new Map<string, number>();
        for (const s of data || []) {
          const fid = s.forwarder_id || 'unknown';
          counts.set(fid, (counts.get(fid) || 0) + 1);
        }
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 4);
        const other = sorted.slice(4).reduce((a, [, v]) => a + v, 0);
        const slices: Slice[] = top.map(([id, v], i) => ({
          name: id.slice(0, 8),
          value: v,
          fill: `url(#fillSlice${i})`
        }));
        if (other > 0) slices.push({ name: 'Other', value: other });
        setData(slices);
        setTotal(sorted.reduce((a, [, v]) => a + v, 0));
      } catch {
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Top Partners</CardTitle>
        <CardDescription>Last 90 days shipments by forwarder</CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        {loading || data.length === 0 ? (
          <div className='text-muted-foreground flex h-[250px] w-full items-center justify-center text-sm'>
            {loading ? 'Loading…' : 'No partner data'}
          </div>
        ) : (
          <PieGraphImpl data={data} total={total} />
        )}
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        {data.length ? (
          <>
            <div className='flex items-center gap-2 leading-none font-medium'>
              Top: {data[0].name} ({((data[0].value / total) * 100).toFixed(1)}
              %)
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground leading-none'>
              Based on last 90 days
            </div>
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}

import { PieGraphImpl } from './pie-graph.impl';
