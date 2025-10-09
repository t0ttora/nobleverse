'use client';
import React from 'react';
import { SidePanel } from '@/components/ui/side-panel';
import type { KpiComputed } from '@/features/dashboard/compute';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Share2,
  Maximize2,
  SlidersHorizontal,
  X,
  Download,
  FilePlus,
  ArrowRight,
  GitCompare,
  CopyPlus
} from 'lucide-react';

type Period = '7d' | '30d' | '90d' | 'custom';

export function KpiDetailsPanel({
  open,
  onClose,
  kpi
}: {
  open: boolean;
  onClose: () => void;
  kpi: KpiComputed | null;
}) {
  const [period, setPeriod] = React.useState<Period>('30d');
  const [tab, setTab] = React.useState<'overview' | 'details' | 'insights'>(
    'overview'
  );
  const [expanded, setExpanded] = React.useState(false);
  const title = kpi?.label || 'Metric';

  function doShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Share link copied to clipboard'),
      () => toast.error('Failed to copy share link')
    );
  }
  function doExport(kind: 'csv' | 'pdf' = 'csv') {
    // Placeholder: surfaces a toast and can be wired to existing CSV/PDF flows
    toast.success(
      `Exported current ${tab} as ${kind.toUpperCase()} successfully.`
    );
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <div className='flex w-full items-center gap-3'>
          {/* Left: icon placeholder + name + subtitle */}
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-md border text-xs font-bold'>
              {title.slice(0, 1)}
            </div>
            <div className='min-w-0'>
              <div className='truncate text-sm font-semibold'>{title}</div>
              <div className='text-muted-foreground truncate text-xs'>
                {kpi?.headline || 'Summary for selected period'}
              </div>
            </div>
          </div>
          {/* Middle: period selector */}
          <div className='ml-auto flex items-center gap-2'>
            <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
              <SelectTrigger className='h-8 w-[150px]'>
                <SelectValue placeholder='Last 30d' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='7d'>Last 7 days</SelectItem>
                <SelectItem value='30d'>Last 30 days</SelectItem>
                <SelectItem value='90d'>Last 90 days</SelectItem>
                <SelectItem value='custom'>Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Right: CTAs */}
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setExpanded((e) => !e)}
              title='Expand View'
            >
              <Maximize2 className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              onClick={doShare}
              title='Share'
            >
              <Share2 className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              onClick={() => toast.info('Filter panel coming soon')}
              title='Filter'
            >
              <SlidersHorizontal className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              onClick={onClose}
              title='Close'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>
      }
      footer={
        <div className='flex w-full items-center justify-between gap-2'>
          <div className='text-muted-foreground text-xs'>
            {kpi?.note || 'Comparing selected period vs previous'}
          </div>
          <div className='flex items-center gap-2'>
            {tab === 'details' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => doExport('csv')}
              >
                <Download className='mr-2 h-4 w-4' /> Export Data
              </Button>
            )}
            {tab === 'insights' && (
              <Button size='sm' onClick={() => doExport('pdf')}>
                <FilePlus className='mr-2 h-4 w-4' /> Create Report
              </Button>
            )}
            <Button
              size='sm'
              variant='secondary'
              onClick={() => toast.info('Compare view coming soon')}
            >
              <GitCompare className='mr-2 h-4 w-4' /> Compare Periods
            </Button>
            <Button
              size='sm'
              onClick={() => toast.info('Navigating to analytics...')}
            >
              <ArrowRight className='mr-2 h-4 w-4' /> Go to Full Analytics
            </Button>
          </div>
        </div>
      }
    >
      {!kpi ? (
        <div className='text-muted-foreground text-sm'>No data.</div>
      ) : (
        <div
          className={`flex flex-col gap-4 ${expanded ? 'max-w-[1100px]' : ''}`}
        >
          {/* Top stat block */}
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-sm'>Current</div>
            <div className='text-3xl font-bold'>{kpi.value}</div>
            {typeof kpi.deltaPct === 'number' && (
              <div className='text-xs'>
                {kpi.deltaPct >= 0 ? '+' : ''}
                {kpi.deltaPct.toFixed(1)}% vs previous period
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='details'>Details</TabsTrigger>
              <TabsTrigger value='insights'>Insights</TabsTrigger>
            </TabsList>
            {/* Overview */}
            <TabsContent value='overview'>
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
                <div className='col-span-2 rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Trend</div>
                  <div className='h-56 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart
                        data={kpi.series || []}
                        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                      >
                        <XAxis
                          dataKey='date'
                          hide
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString()
                          }
                        />
                        <YAxis width={32} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v: any) => String(v)}
                          labelFormatter={(l) =>
                            new Date(l).toLocaleDateString()
                          }
                        />
                        <Line
                          type='monotone'
                          dataKey='value'
                          stroke='var(--primary)'
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Breakdown</div>
                  <div className='text-muted-foreground text-xs'>
                    Donut/Bar breakdown will appear here (by
                    partner/route/type).
                  </div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Top Partner</div>
                  <div className='text-sm'>—</div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Average</div>
                  <div className='text-sm'>—</div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>
                    Change vs 30d
                  </div>
                  <div className='text-sm'>—</div>
                </div>
              </div>
            </TabsContent>
            {/* Details */}
            <TabsContent value='details'>
              <div className='rounded-lg border p-2'>
                <div className='mb-2 text-sm font-semibold'>Details</div>
                <div className='text-muted-foreground text-xs'>
                  Data table (sortable/searchable) will be rendered here based
                  on KPI type.
                </div>
              </div>
            </TabsContent>
            {/* Insights */}
            <TabsContent value='insights'>
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <div className='rounded-lg border p-3'>
                  <div className='mb-2 text-sm font-semibold'>AI Summary</div>
                  <p className='text-sm'>
                    Your {kpi.label.toLowerCase()} remained{' '}
                    {kpi.trend === 'flat'
                      ? 'stable'
                      : kpi.trend === 'up'
                        ? 'elevated'
                        : 'lower'}
                    {typeof kpi.deltaPct === 'number'
                      ? ` (${kpi.deltaPct >= 0 ? '+' : ''}${kpi.deltaPct.toFixed(1)}%)`
                      : ''}{' '}
                    this period.
                  </p>
                  <ul className='mt-2 list-disc pl-5 text-sm'>
                    <li>
                      Consider consolidating smaller operations to optimize
                      costs.
                    </li>
                    <li>Review partner performance and adjust allocations.</li>
                  </ul>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='mb-2 text-sm font-semibold'>
                    Trend Breakdown
                  </div>
                  <div className='h-40 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={kpi.series || []}>
                        <XAxis dataKey='date' hide />
                        <YAxis hide />
                        <Line
                          type='monotone'
                          dataKey='value'
                          stroke='var(--primary)'
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </SidePanel>
  );
}
