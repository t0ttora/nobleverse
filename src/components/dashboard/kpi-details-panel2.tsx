'use client';
import React from 'react';
import { SidePanel } from '@/components/ui/side-panel';
import type { KpiComputed } from '@/features/dashboard/compute';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '@/components/ui/table';
// Icons intentionally omitted to avoid transient typecheck issues with library exports; using text labels instead
import { supabase } from '@/lib/supabaseClient';

type Period = '7d' | '30d' | '90d' | 'custom';

export function KpiDetailsPanel({
  open,
  onClose,
  kpi,
  role,
  userId,
  shipments,
  requests,
  offers,
  notifications
}: {
  open: boolean;
  onClose: () => void;
  kpi: KpiComputed | null;
  role?: 'shipper' | 'forwarder' | 'receiver' | 'customs';
  userId?: string;
  shipments?: Array<any>;
  requests?: Array<any>;
  offers?: Array<any>;
  notifications?: Array<any>;
}) {
  const [period, setPeriod] = React.useState<Period>('30d');
  const [tab, setTab] = React.useState<'overview' | 'details' | 'insights'>(
    'overview'
  );
  const [expanded, setExpanded] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const title = kpi?.label || 'Metric';

  function doShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Share link copied to clipboard'),
      () => toast.error('Failed to copy share link')
    );
  }
  // Simple in-panel CSV export for Details table rows
  function toCSV<T extends Record<string, any>>(rows: T[], columns: string[]) {
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const header = columns.join(',');
    const lines = rows.map((r) => columns.map((c) => escape(r[c])).join(','));
    return [header, ...lines].join('\n');
  }

  function doExport(kind: 'csv' | 'pdf' = 'csv') {
    if (kind === 'csv') {
      const { rows, columns } = buildDetailsData();
      if (!rows.length) return toast.info('No rows to export');
      const csv = toCSV(rows, columns);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(kpi?.key || 'export').replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // Naive PDF export via print
    const w = window.open('', '_blank');
    if (!w) return toast.error('Popup blocked');
    const { rows, columns } = buildDetailsData();
    const tableHtml = `
          <table style="width:100%;border-collapse:collapse;font-family:system-ui,Segoe UI,Arial">
            <thead><tr>${columns
              .map(
                (c) =>
                  `<th style="border:1px solid #ddd;padding:6px;text-align:left">${c}</th>`
              )
              .join('')}</tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) =>
                    `<tr>${columns
                      .map(
                        (c) =>
                          `<td style=\"border:1px solid #ddd;padding:6px\">${r[c] ?? ''}</td>`
                      )
                      .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>`;
    w.document.write(`
          <html><head><title>${title} — Export</title></head>
          <body>
            <h3>${title} (${kpi?.key})</h3>
            ${tableHtml}
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); }<\/script>
          </body></html>`);
    w.document.close();
  }

  // Helpers
  function bucketCounts(dates: string[], bucketDays = 7) {
    const MS = 86400000 * bucketDays;
    const pts = dates
      .map((d) => new Date(d || Date.now()).getTime())
      .filter((t) => Number.isFinite(t));
    if (!pts.length) return [];
    const min = Math.min(...pts);
    const start = Math.floor(min / MS) * MS;
    const map = new Map<number, number>();
    for (const t of pts) {
      const b = Math.floor((t - start) / MS) * MS + start;
      map.set(b, (map.get(b) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, v]) => ({ date: new Date(ts).toISOString(), value: v }));
  }

  function buildSeries() {
    const key = kpi?.key || '';
    // Prefer precomputed series
    if (kpi?.series && kpi.series.length) return kpi.series;
    if (key === 'quotes_sent' && offers?.length) {
      return bucketCounts(offers.map((o) => o.created_at));
    }
    if (key === 'active_shipments' && shipments?.length) {
      return bucketCounts(shipments.map((s) => s.created_at || s.updated_at));
    }
    if (key === 'open_requests' && requests?.length) {
      return bucketCounts(requests.map((r) => r.created_at));
    }
    if (key === 'unread_notifications' && notifications?.length) {
      return bucketCounts(notifications.map((n) => n.created_at));
    }
    if (key === 'acceptance_rate' && offers?.length) {
      // compute daily acceptance rate: accepted / sent per bucket
      const byDay: Record<string, { sent: number; acc: number }> = {};
      for (const o of offers) {
        const day = new Date(o.created_at || Date.now())
          .toISOString()
          .slice(0, 10);
        const row = (byDay[day] ||= { sent: 0, acc: 0 });
        row.sent += 1;
        if (o.status === 'accepted') row.acc += 1;
      }
      const entries = Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([d, v]) => ({
          date: d,
          value: v.sent ? (v.acc / v.sent) * 100 : 0
        }));
      return entries;
    }
    // Fallback empty
    return [] as any[];
  }

  function buildDetailsData(): {
    columns: string[];
    rows: Array<Record<string, any>>;
  } {
    const key = kpi?.key || '';
    const q = search.toLowerCase();
    const dateFmt = (s?: string) => (s ? new Date(s).toLocaleString() : '—');
    if (role === 'shipper') {
      if (
        key === 'total_spend' ||
        key === 'in_transit' ||
        key === 'delivery_rate'
      ) {
        const base = (shipments || []).filter((s) =>
          key === 'in_transit' ? s.status === 'in_transit' : true
        );
        const rows = base
          .map((s) => ({
            shipment_id: s.id,
            forwarder_id: s.forwarder_id || '—',
            cost_usd:
              typeof s.net_amount_cents === 'number'
                ? (s.net_amount_cents / 100).toFixed(2)
                : '—',
            status: s.status,
            created_at: dateFmt(s.created_at),
            updated_at: dateFmt(s.updated_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return {
          columns: [
            'shipment_id',
            'forwarder_id',
            'cost_usd',
            'status',
            'created_at',
            'updated_at'
          ],
          rows
        };
      }
      if (key === 'open_requests') {
        const rows = (requests || [])
          .map((r) => ({
            request_id: r.id,
            status: r.status || '—',
            created_at: dateFmt(r.created_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return { columns: ['request_id', 'status', 'created_at'], rows };
      }
    }
    if (role === 'forwarder') {
      if (key === 'active_shipments') {
        const rows = (shipments || [])
          .map((s) => ({
            shipment_id: s.id,
            shipper_id: s.owner_id || '—',
            status: s.status,
            created_at: dateFmt(s.created_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return {
          columns: ['shipment_id', 'shipper_id', 'status', 'created_at'],
          rows
        };
      }
      if (key === 'quotes_sent' || key === 'acceptance_rate') {
        const rows = (offers || [])
          .map((o) => ({
            offer_id: o.id,
            request_id: o.request_id,
            price_usd:
              typeof o.amount_cents === 'number'
                ? (o.amount_cents / 100).toFixed(2)
                : '—',
            status: o.status || '—',
            created_at: dateFmt(o.created_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return {
          columns: [
            'offer_id',
            'request_id',
            'price_usd',
            'status',
            'created_at'
          ],
          rows
        };
      }
    }
    if (role === 'receiver') {
      if (key === 'incoming_shipments' || key === 'delivery_accuracy') {
        const rows = (shipments || [])
          .map((s) => ({
            shipment_id: s.id,
            forwarder_id: s.forwarder_id || '—',
            status: s.status,
            eta: dateFmt(s.eta),
            updated_at: dateFmt(s.updated_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return {
          columns: [
            'shipment_id',
            'forwarder_id',
            'status',
            'eta',
            'updated_at'
          ],
          rows
        };
      }
      if (key === 'unread_notifications') {
        const rows = (notifications || [])
          .map((n) => ({
            notification_id: n.id,
            title: n.title || '—',
            type: n.type || '—',
            created_at: dateFmt(n.created_at),
            read_at: dateFmt(n.read_at)
          }))
          .filter(
            (r) =>
              !q ||
              Object.values(r).some((v) => String(v).toLowerCase().includes(q))
          );
        return {
          columns: [
            'notification_id',
            'title',
            'type',
            'created_at',
            'read_at'
          ],
          rows
        };
      }
    }
    return { columns: [], rows: [] };
  }

  async function markAllNotificationsRead() {
    if (!userId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .eq('recipient_id', userId);
    if (error) toast.error('Failed to mark all as read');
    else toast.success('All notifications marked as read');
  }

  const series = React.useMemo(
    () => buildSeries(),
    [kpi, shipments, requests, offers, notifications, period]
  );

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <div className='flex w-full items-center gap-3'>
          {/* Minimal icon placeholder */}
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-9 w-9 items-center justify-center rounded-md border text-xs font-bold'>
              {kpi?.key?.slice(0, 1).toUpperCase() || 'KPI'}
            </div>
            <div className='min-w-0'>
              <div className='truncate text-sm font-semibold'>{title}</div>
              <div className='text-muted-foreground truncate text-xs'>
                {(kpi?.headline || 'Detailed view and actions') +
                  (kpi?.note ? ` — ${kpi.note}` : '')}
              </div>
            </div>
          </div>
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
            {/* Icons replaced with text glyphs to avoid lucide-react named export issues */}
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setExpanded((v) => !v)}
                title='Expand View'
                aria-label='Expand View'
              >
                [ ]
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={doShare}
                title='Share'
                aria-label='Share'
              >
                ⇪
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => toast.info('Filters coming soon')}
                title='Filter'
                aria-label='Filter'
              >
                ≡
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={onClose}
                title='Close'
                aria-label='Close'
              >
                ×
              </Button>
            </div>
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
          {/* Overview KPIs + chart */}
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-sm'>Current</div>
            <div className='text-3xl font-bold'>
              {String(kpi.value)}
              {(kpi.key?.includes('rate') || kpi.key?.includes('accuracy')) &&
                '%'}
            </div>
            {kpi.deltaPct != null && (
              <div className='text-xs'>
                {kpi.deltaPct >= 0 ? '▲' : '▼'}{' '}
                {Math.abs(kpi.deltaPct).toFixed(1)}% vs prior
              </div>
            )}
          </div>
          <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='details'>Details</TabsTrigger>
              <TabsTrigger value='insights'>Insights</TabsTrigger>
            </TabsList>
            <TabsContent value='overview'>
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
                <div className='col-span-2 rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Trend</div>
                  <div className='h-56 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart
                        data={buildSeries()}
                        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                      >
                        <XAxis
                          dataKey='date'
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d: string) => (d || '').slice(5, 10)}
                        />
                        <YAxis width={32} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v: any) => String(v)}
                          labelFormatter={(d: string) =>
                            new Date(d).toLocaleDateString()
                          }
                        />
                        <Line
                          type='monotone'
                          dataKey='value'
                          stroke='#0ea5e9'
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
                    By partner, mode, or route — coming soon.
                  </div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Top Partner</div>
                  <div className='text-sm'>
                    Placeholder partner (improve with real data)
                  </div>
                </div>
                <div className='rounded-lg border p-2'>
                  <div className='mb-2 text-sm font-semibold'>Average</div>
                  <div className='text-sm'>
                    {Array.isArray(series) && series.length
                      ? (
                          series.reduce(
                            (a: number, b: any) => a + (b.value || 0),
                            0
                          ) / series.length
                        ).toFixed(2)
                      : '—'}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value='details'>
              <div className='flex items-center justify-between gap-2'>
                <div className='text-sm font-semibold'>Details</div>
                <div className='flex items-center gap-2'>
                  {role === 'receiver' &&
                    kpi.key === 'unread_notifications' && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={markAllNotificationsRead}
                      >
                        Mark all as read
                      </Button>
                    )}
                  {role === 'shipper' && kpi.key === 'open_requests' && (
                    <Button
                      size='sm'
                      onClick={() =>
                        (window.location.href = '/shipments/requests')
                      }
                    >
                      New Request
                    </Button>
                  )}
                </div>
              </div>
              <div className='my-2'>
                <Input
                  placeholder='Search...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='h-8 max-w-sm'
                />
              </div>
              {(() => {
                const { rows, columns } = buildDetailsData();
                if (!rows.length) {
                  return (
                    <div className='text-muted-foreground rounded-lg border p-3 text-sm'>
                      No details for this KPI.
                    </div>
                  );
                }
                return (
                  <div className='rounded-lg border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map((c) => (
                            <TableHead key={c} className='capitalize'>
                              {c.replace(/_/g, ' ')}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, idx) => (
                          <TableRow key={idx}>
                            {columns.map((c) => (
                              <TableCell key={c}>
                                {(r as any)[c] ?? '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {!rows.length && (
                          <TableRow>
                            <TableCell
                              colSpan={columns.length}
                              className='text-muted-foreground h-16 text-center text-sm'
                            >
                              No data available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
              <div className='mt-2 flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => doExport('csv')}
                >
                  Export CSV
                </Button>
                <Button size='sm' onClick={() => doExport('pdf')}>
                  Export PDF
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => toast.info('Compare view coming soon')}
                >
                  Compare Periods
                </Button>
                <Button
                  size='sm'
                  onClick={() => toast.info('Navigating to analytics...')}
                >
                  Go to Analytics
                </Button>
              </div>
            </TabsContent>
            <TabsContent value='insights'>
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <div className='rounded-lg border p-3'>
                  <div className='mb-2 text-sm font-semibold'>AI Summary</div>
                  <p className='text-sm'>
                    Overall, this metric shows stable performance. Consider
                    drill-downs in Details for specifics.
                  </p>
                  <ul className='mt-2 list-disc pl-5 text-sm'>
                    <li>
                      Watch for spikes or drops; use filtering to isolate
                      partners or routes.
                    </li>
                    <li>Review partner performance and adjust allocations.</li>
                  </ul>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='mb-2 text-sm font-semibold'>Forecast</div>
                  <div className='h-40 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={buildSeries()}>
                        <XAxis dataKey='date' hide />
                        <YAxis hide />
                        <Line
                          type='monotone'
                          dataKey='value'
                          stroke='#10b981'
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
