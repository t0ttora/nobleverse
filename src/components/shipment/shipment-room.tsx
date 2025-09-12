'use client';
import { ShipmentHeader, MilestonesPanel, EscrowPanel } from './';
import { RealtimeChat } from '@/components/realtime-chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import {
  IconFile,
  IconMap,
  IconCash,
  IconFolder,
  IconBarcode,
  IconShieldLock,
  IconSettings,
  IconAdjustments
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface ShipmentRoomProps {
  shipment: any;
  currentUserId: string;
}

export default function ShipmentRoom({
  shipment,
  currentUserId
}: ShipmentRoomProps) {
  const total = shipment.total_amount_cents / 100;
  const fee = shipment.platform_fee_cents / 100;
  const net = shipment.net_amount_cents / 100;
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [leftWidth, setLeftWidth] = useState(560);
  // Responsive: mobile stacked view state
  const [mobileView, setMobileView] = useState<'chat' | 'details'>('chat');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isResizing = useRef(false);
  const handleCreateShare = async () => {
    const r = await fetch(`/api/shipments/${shipment.id}/share`, {
      method: 'POST'
    });
    if (!r.ok) throw new Error('Failed');
    const j = await r.json();
    return j.url as string;
  };
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const min = 380,
      max = Math.min(rect.width - 320, 880);
    let w = e.clientX - rect.left;
    if (w < min) w = min;
    if (w > max) w = max;
    setLeftWidth(w);
  }, []);
  const stop = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stop);
  }, [onMouseMove]);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
  };

  // Ensure chat room exists and load initial messages from unified chat_messages
  const [initialMessages, setInitialMessages] = useState<
    import('@/hooks/use-realtime-chat').ChatMessage[]
  >([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Ensure room & membership
        try {
          await (supabase as any).rpc('ensure_shipment_chat', {
            p_shipment: shipment.id
          });
        } catch {
          /* ignore */
        }
        // Load members for name mapping
        const { data: mems } = await (supabase as any)
          .from('chat_members')
          .select(
            'profiles:profiles!inner(id,username,display_name,avatar_url)'
          )
          .eq('room_id', shipment.id);
        const members: Array<{
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
        }> = (mems || []).map((m: any) => m.profiles);
        const nameMap = new Map<
          string,
          { name: string; avatar_url?: string | null }
        >();
        for (const m of members) {
          const label = (m.display_name || m.username || 'User') as string;
          nameMap.set(m.id, {
            name: label,
            avatar_url: m.avatar_url || undefined
          });
        }
        // Load last 300 persisted messages for the room
        const { data: rows } = await (supabase as any)
          .from('chat_messages')
          .select('id, room_id, sender_id, content, created_at')
          .eq('room_id', shipment.id)
          .order('created_at', { ascending: true })
          .limit(300);
        const mapped = (rows || []).map((r: any) => ({
          id: r.id as string,
          content: (r.content as string) || '',
          user: {
            id: r.sender_id as string,
            name: nameMap.get(r.sender_id as string)?.name || 'User',
            avatar_url: nameMap.get(r.sender_id as string)?.avatar_url
          },
          createdAt: r.created_at as string
        }));
        if (alive) setInitialMessages(mapped);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [shipment.id]);

  return (
    <div className='flex h-full min-h-0 w-full flex-1 flex-col'>
      <ShipmentHeader
        shipment={shipment}
        onShare={async () => {
          try {
            return await handleCreateShare();
          } catch (e: any) {
            toast.error(e.message);
            throw e;
          }
        }}
        progress={
          shipment.milestone_count
            ? (shipment.milestone_count * 100) /
              Math.max(4, shipment.milestone_count)
            : 0
        }
        mobileToggle={
          isMobile ? (
            <div className='ml-auto flex items-center gap-2 pr-2'>
              <Button
                variant={mobileView === 'chat' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setMobileView('chat')}
                className='h-7 px-3 text-[11px] leading-none'
              >
                Chat
              </Button>
              <Button
                variant={mobileView === 'details' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setMobileView('details')}
                className='h-7 px-3 text-[11px] leading-none'
              >
                Details
              </Button>
            </div>
          ) : null
        }
      />
      {/* Desktop / large layout */}
      <div
        ref={containerRef}
        className={cn(
          'flex flex-1 overflow-hidden',
          isMobile && 'hidden md:flex'
        )}
      >
        <div
          className='bg-card/30 hidden flex-col overflow-hidden border-r backdrop-blur md:flex'
          style={{ width: leftWidth }}
        >
          <div className='flex h-full flex-col'>
            <div className='flex flex-1 flex-col overflow-hidden'>
              <div className='flex flex-1 flex-col'>
                <RealtimeChat
                  roomName={shipment.id}
                  username={currentUserId.slice(0, 6)}
                  userId={currentUserId}
                  mode='chat'
                  messages={initialMessages}
                  roomTitle={shipment.code || undefined}
                />
              </div>
            </div>
          </div>
        </div>
        <div
          onMouseDown={startResize}
          className='hover:bg-primary/30 hidden w-2 cursor-col-resize transition-colors md:block'
        />
        <div className='flex flex-1 overflow-hidden'>
          <div className='flex flex-1 flex-col overflow-hidden'>
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className='flex flex-1 flex-col overflow-hidden'
            >
              <TabsList className='scrollbar-thin w-full justify-start overflow-x-auto'>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='tracking'>Tracking</TabsTrigger>
                <TabsTrigger value='docs'>Docs</TabsTrigger>
                <TabsTrigger value='financial'>Financial</TabsTrigger>
                <TabsTrigger value='scans'>Scans</TabsTrigger>
                <TabsTrigger value='settings'>Settings</TabsTrigger>
              </TabsList>
              <TabsContent
                value='overview'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <OverviewTab
                  shipment={shipment}
                  total={total}
                  fee={fee}
                  net={net}
                />
              </TabsContent>
              <TabsContent
                value='tracking'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <TrackingTab shipment={shipment} />
              </TabsContent>
              <TabsContent
                value='docs'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <DocumentsTab shipment={shipment} />
              </TabsContent>
              <TabsContent
                value='financial'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <FinancialTab
                  shipment={shipment}
                  total={total}
                  fee={fee}
                  net={net}
                />
              </TabsContent>
              <TabsContent
                value='scans'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <ScansTab shipment={shipment} />
              </TabsContent>
              <TabsContent
                value='settings'
                className='flex-1 space-y-6 overflow-auto p-4'
              >
                <SettingsTab shipment={shipment} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      {/* Mobile stacked view */}
      {isMobile && (
        <div className='flex flex-1 flex-col overflow-hidden md:hidden'>
          {mobileView === 'chat' && (
            <div className='flex flex-1 flex-col overflow-hidden'>
              <RealtimeChat
                roomName={shipment.id}
                username={currentUserId.slice(0, 6)}
                userId={currentUserId}
                mode='chat'
                messages={initialMessages}
                roomTitle={shipment.code || undefined}
              />
            </div>
          )}
          {mobileView === 'details' && (
            <div className='flex flex-1 flex-col overflow-hidden'>
              <Tabs
                value={activeTab}
                onValueChange={(v: any) => setActiveTab(v)}
                className='flex flex-1 flex-col overflow-hidden'
              >
                <TabsList className='scrollbar-thin w-full justify-start overflow-x-auto px-1'>
                  <TabsTrigger value='overview'>Overview</TabsTrigger>
                  <TabsTrigger value='tracking'>Tracking</TabsTrigger>
                  <TabsTrigger value='docs'>Docs</TabsTrigger>
                  <TabsTrigger value='financial'>Fin</TabsTrigger>
                  <TabsTrigger value='scans'>Scans</TabsTrigger>
                  <TabsTrigger value='settings'>Settings</TabsTrigger>
                </TabsList>
                <TabsContent
                  value='overview'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <OverviewTab
                    shipment={shipment}
                    total={total}
                    fee={fee}
                    net={net}
                  />
                </TabsContent>
                <TabsContent
                  value='tracking'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <TrackingTab shipment={shipment} />
                </TabsContent>
                <TabsContent
                  value='docs'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <DocumentsTab shipment={shipment} />
                </TabsContent>
                <TabsContent
                  value='financial'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <FinancialTab
                    shipment={shipment}
                    total={total}
                    fee={fee}
                    net={net}
                  />
                </TabsContent>
                <TabsContent
                  value='scans'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <ScansTab shipment={shipment} />
                </TabsContent>
                <TabsContent
                  value='settings'
                  className='flex-1 space-y-4 overflow-auto p-3'
                >
                  <SettingsTab shipment={shipment} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}
      <MilestonesFooter shipmentId={shipment.id} />
    </div>
  );
}

type TabKey =
  | 'overview'
  | 'tracking'
  | 'docs'
  | 'financial'
  | 'scans'
  | 'settings';

// Removed custom TabsHeader in favor of shadcn Tabs

function OverviewTab({
  shipment,
  total,
  fee,
  net
}: {
  shipment: any;
  total: number;
  fee: number;
  net: number;
}) {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-6'>
        <KpiCard label='Total' value={`$${total.toFixed(2)}`} sub='Gross' />
        <KpiCard label='Fee' value={`$${fee.toFixed(2)}`} sub='Platform' />
        <KpiCard label='Net' value={`$${net.toFixed(2)}`} sub='To Forwarder' />
        <KpiCard label='Status' value={shipment.status} sub='Shipment' />
        <KpiCard label='Escrow' value={shipment.escrow_status} sub='State' />
        <KpiCard
          label='Milestones'
          value={shipment.milestone_count ?? '—'}
          sub='Count'
        />
      </div>
      <div className='grid gap-3 sm:gap-4 md:grid-cols-3'>
        <Card className='md:col-span-2'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Cargo Info</CardTitle>
          </CardHeader>
          <CardContent className='text-muted-foreground space-y-1 text-xs'>
            <div>Origin: {shipment.origin || '—'}</div>
            <div>Destination: {shipment.destination || '—'}</div>
            <div>Mode: {shipment.mode || '—'}</div>
            <div>Incoterm: {shipment.incoterm || '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Participants</CardTitle>
          </CardHeader>
          <CardContent className='text-muted-foreground space-y-1 text-xs'>
            <div>Owner: {shipment.owner_id?.slice(0, 8) || '—'}</div>
            <div>Forwarder: {shipment.forwarder_id?.slice(0, 8) || '—'}</div>
          </CardContent>
        </Card>
      </div>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='bg-card/40 rounded-lg border'>
          <EscrowPanel shipment={shipment} />
        </div>
        <MilestoneSummary shipmentId={shipment.id} />
      </div>
    </div>
  );
}

function TrackingTab({ shipment }: { shipment: any }) {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm'>
            <IconMap className='h-4 w-4' /> Route Map
          </CardTitle>
        </CardHeader>
        <CardContent className='text-muted-foreground flex h-52 items-center justify-center text-xs'>
          Map widget TBD
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>Milestone Timeline</CardTitle>
        </CardHeader>
        <CardContent className='text-muted-foreground space-y-2 text-xs'>
          Vertical timeline TBD
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({ shipment }: { shipment: any }) {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium'>Documents</h3>
        <Button size='sm' variant='outline'>
          Upload
        </Button>
      </div>
      <Card>
        <CardContent className='text-muted-foreground p-4 text-xs'>
          No documents yet.
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialTab({
  shipment,
  total,
  fee,
  net
}: {
  shipment: any;
  total: number;
  fee: number;
  net: number;
}) {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-4 xl:grid-cols-6'>
        <KpiCard label='Total' value={`$${total.toFixed(2)}`} sub='Gross' />
        <KpiCard label='Fee' value={`$${fee.toFixed(2)}`} sub='Platform' />
        <KpiCard label='Net' value={`$${net.toFixed(2)}`} sub='To Forwarder' />
        <KpiCard label='Status' value={shipment.status} sub='Shipment' />
        <KpiCard label='Escrow' value={shipment.escrow_status} sub='State' />
        <KpiCard
          label='Milestones'
          value={shipment.milestone_count ?? '—'}
          sub='Count'
        />
      </div>
      <EscrowLedgerTable shipmentId={shipment.id} />
      <div className='bg-card/40 rounded-lg border'>
        <EscrowPanel shipment={shipment} />
      </div>
    </div>
  );
}

function ScansTab({ shipment }: { shipment: any }) {
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm'>
            <IconBarcode className='h-4 w-4' /> Scans
          </CardTitle>
        </CardHeader>
        <CardContent className='text-xs'>
          <RealtimeScans shipmentId={shipment.id} />
        </CardContent>
      </Card>
      <Button
        size='sm'
        variant='outline'
        onClick={() =>
          fetch(`/api/shipments/${shipment.id}/label`, { method: 'POST' })
        }
      >
        Regenerate Label
      </Button>
    </div>
  );
}

function SettingsTab({ shipment }: { shipment: any }) {
  const [loading, setLoading] = useState<string | null>(null);
  const call = async (status: string) => {
    setLoading(status);
    try {
      await fetch(`/api/shipments/${shipment.id}/force-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } finally {
      setLoading(null);
    }
  };
  const disableLinks = async () => {
    if (!confirm('Disable all active public share links?')) return;
    setLoading('disable-links');
    try {
      await fetch(`/api/shipments/${shipment.id}/share`, { method: 'DELETE' });
    } finally {
      setLoading(null);
    }
  };
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm'>
            <IconSettings className='h-4 w-4' /> Settings
          </CardTitle>
        </CardHeader>
        <CardContent className='text-muted-foreground space-y-3 text-xs'>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={loading === 'delivered'}
              onClick={() => call('delivered')}
            >
              {loading === 'delivered' ? '…' : 'Force Delivered'}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={loading === 'in_transit'}
              onClick={() => call('in_transit')}
            >
              {loading === 'in_transit' ? '…' : 'Force Status In-Transit'}
            </Button>
            <Button size='sm' variant='destructive' disabled>
              Close Dispute
            </Button>
          </div>
          <div className='border-t pt-2'>
            <div className='text-foreground mb-1 flex items-center gap-1 font-medium'>
              <IconAdjustments className='h-3 w-3' /> Share Links
            </div>
            <Button
              size='sm'
              variant='destructive'
              disabled={loading === 'disable-links'}
              onClick={disableLinks}
            >
              {loading === 'disable-links' ? 'Working…' : 'Disable All Links'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// InfoSidebar removed

function MilestonesFooter({ shipmentId }: { shipmentId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    let channel: any;
    (async () => {
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      setItems(data || []);
      channel = supabase
        .channel(`footer:milestones:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'milestones',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (p: any) => {
            setItems((i) => [...i, p.new]);
          }
        )
        .subscribe();
    })();
    return () => {
      channel && supabase.removeChannel(channel);
    };
  }, [shipmentId]);
  return (
    <div className='relative' style={{ height: '4vh' }}>
      <HoverCard openDelay={60} closeDelay={80}>
        <HoverCardTrigger asChild>
          <div className='bg-background/80 group absolute inset-0 flex cursor-pointer items-center overflow-hidden border-t backdrop-blur'>
            {items.length === 0 ? (
              <div className='text-muted-foreground px-4 text-[11px]'>
                No milestones
              </div>
            ) : (
              <div className='relative h-full w-full'>
                <div
                  className='marquee-track flex items-center gap-6 px-4 text-[11px] whitespace-nowrap'
                  style={{
                    // duration scales with total items (fallback minimum 25s)
                    animationDuration: `${Math.max(25, items.length * 5)}s`
                  }}
                >
                  {[0, 1].map((rep) => (
                    <div
                      key={rep}
                      className='flex items-center gap-6'
                      aria-hidden={rep === 1}
                    >
                      {items.map((m) => (
                        <div
                          key={m.id + ':' + rep}
                          className='flex items-center gap-1'
                        >
                          <span className='bg-muted/40 rounded border px-1.5 py-0.5 capitalize'>
                            {m.code?.replace(/_/g, ' ')}
                          </span>
                          <span className='text-[10px] opacity-60'>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className='from-background/90 pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r to-transparent' />
                <div className='from-background/90 pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l to-transparent' />
              </div>
            )}
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side='top'
          align='end'
          alignOffset={-56}
          className='max-h-80 w-72 origin-bottom-right overflow-auto p-3'
        >
          <div className='text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase'>
            Milestones Timeline
          </div>
          {items.length === 0 && (
            <div className='text-muted-foreground text-xs'>
              No milestones yet.
            </div>
          )}
          {items.length > 0 && (
            <ol className='border-border/40 relative ml-2 border-l text-xs'>
              {[...items]
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                ) // latest first
                .map((m, idx, arr) => {
                  const code: string = (m.code || '').toLowerCase();
                  const ts = new Date(m.created_at);
                  const time = ts.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const full = ts.toLocaleDateString() + ' ' + time;
                  const isLatest = idx === 0;
                  const success =
                    /(delivered|completed|fulfilled|success|authorized)/.test(
                      code
                    );
                  const warn =
                    /(processing|attempt|pending|in_transit|await)/.test(code);
                  const danger = /(failed|error|declined|cancel)/.test(code);
                  let color = 'var(--muted-foreground)';
                  if (success) color = 'rgb(34 197 94)';
                  else if (danger) color = 'rgb(239 68 68)';
                  else if (warn) color = 'rgb(245 158 11)';
                  const icon = success
                    ? '✓'
                    : danger
                      ? '✕'
                      : isLatest && warn
                        ? '…'
                        : '';
                  return (
                    <li
                      key={m.id}
                      className='group relative pr-2 pb-4 pl-5 last:pb-0'
                    >
                      <span
                        className='ring-background absolute top-1.5 -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold ring-4'
                        style={{ background: color, color: '#fff' }}
                      >
                        {icon || ''}
                      </span>
                      <div className='flex items-start gap-2'>
                        <div className='min-w-[58px] pt-0.5 font-mono text-[10px] leading-none opacity-70'>
                          {time}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <div
                            className='truncate leading-snug font-medium capitalize'
                            title={m.label || m.code}
                          >
                            {(m.label || m.code || '').replace(/_/g, ' ')}
                          </div>
                          <div className='text-[10px] leading-tight opacity-60'>
                            {full}
                          </div>
                        </div>
                      </div>
                      {idx !== arr.length - 1 && (
                        <span className='bg-border/50 absolute top-5 bottom-0 left-[-1px] w-px' />
                      )}
                    </li>
                  );
                })}
            </ol>
          )}
        </HoverCardContent>
      </HoverCard>
      <style jsx>{`
        .marquee-track {
          display: inline-flex;
          animation: marquee linear infinite;
          will-change: transform;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

// Helper components
function RealtimeScans({ shipmentId }: { shipmentId: string }) {
  const [scans, setScans] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase
        .from('scans')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('scanned_at');
      setScans(data || []);
      sub = supabase
        .channel(`realtime:scans:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scans',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (p: any) => {
            if (p.eventType === 'INSERT') setScans((s) => [...s, p.new]);
          }
        )
        .subscribe();
    })();
    return () => {
      sub && supabase.removeChannel(sub);
    };
  }, [shipmentId]);
  return (
    <div className='space-y-2'>
      {scans.map((s) => (
        <div
          key={s.id}
          className='bg-card/30 flex items-center justify-between rounded border p-2'
        >
          <span>{new Date(s.scanned_at).toLocaleString()}</span>
          <span className='text-[10px] opacity-60'>{s.location || '—'}</span>
        </div>
      ))}
      {scans.length === 0 && (
        <div className='text-muted-foreground text-xs'>No scans yet.</div>
      )}
    </div>
  );
}

function EscrowLedgerTable({ shipmentId }: { shipmentId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase
        .from('escrow_ledger')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      setRows(data || []);
      sub = supabase
        .channel(`realtime:escrow:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'escrow_ledger',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (p: any) => {
            if (p.eventType === 'INSERT') setRows((r) => [...r, p.new]);
          }
        )
        .subscribe();
    })();
    return () => {
      sub && supabase.removeChannel(sub);
    };
  }, [shipmentId]);
  const total =
    rows.reduce(
      (a, r) =>
        a + (r.entry_type === 'REFUND' ? -r.amount_cents : r.amount_cents),
      0
    ) / 100;
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <IconCash className='h-4 w-4' /> Escrow Ledger
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='max-h-64 overflow-auto'>
          <table className='min-w-full text-xs'>
            <thead className='bg-muted/40 text-[10px] tracking-wide uppercase'>
              <tr className='text-left'>
                <th className='px-2 py-1 font-medium'>Time</th>
                <th className='px-2 py-1 font-medium'>Type</th>
                <th className='px-2 py-1 font-medium'>Meta</th>
                <th className='px-2 py-1 text-right font-medium'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const amt = r.amount_cents / 100;
                const sign = r.entry_type === 'REFUND' ? -amt : amt;
                const cls =
                  r.entry_type === 'REFUND'
                    ? 'text-red-500'
                    : r.entry_type === 'RELEASE'
                      ? 'text-emerald-600'
                      : r.entry_type === 'FEE'
                        ? 'text-amber-600'
                        : 'text-foreground';
                return (
                  <tr key={r.id} className='hover:bg-muted/30 border-t'>
                    <td className='px-2 py-1 whitespace-nowrap'>
                      {new Date(r.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className='px-2 py-1'>{r.entry_type}</td>
                    <td
                      className='max-w-[140px] truncate px-2 py-1'
                      title={JSON.stringify(r.meta || {})}
                    >
                      {r.meta?.partial
                        ? 'partial'
                        : r.meta?.full
                          ? 'full'
                          : r.meta?.manual
                            ? 'manual'
                            : '-'}
                    </td>
                    <td className={'px-2 py-1 text-right font-medium ' + cls}>
                      {sign.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className='text-muted-foreground px-2 py-4 text-center'
                  >
                    No entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex justify-end gap-2 border-t px-2 py-1 text-[11px]'>
          <span className='opacity-60'>Net:</span>
          <span className='font-semibold'>${total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentsMini({ shipmentId }: { shipmentId: string }) {
  return (
    <div>
      <h4 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide'>
        DOCS (0)
      </h4>
      <div className='text-muted-foreground text-xs'>
        No documents uploaded.
      </div>
    </div>
  );
}

function MilestoneSummary({ shipmentId }: { shipmentId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      setItems(data || []);
      sub = supabase
        .channel(`realtime:milestones:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'milestones',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (p: any) => {
            if (p.eventType === 'INSERT') setItems((i) => [...i, p.new]);
          }
        )
        .subscribe();
    })();
    return () => {
      sub && supabase.removeChannel(sub);
    };
  }, [shipmentId]);
  return (
    <Card className='h-full'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm'>Milestones</CardTitle>
      </CardHeader>
      <CardContent className='max-h-56 space-y-2 overflow-auto text-xs'>
        {items.map((m) => (
          <div key={m.id} className='flex items-center gap-2'>
            <span className='bg-muted rounded border px-1.5 py-0.5 text-[10px]'>
              {m.code}
            </span>
            <span className='truncate'>{m.label || m.code}</span>
          </div>
        ))}
        {items.length === 0 && (
          <div className='text-muted-foreground'>No milestones.</div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className='border-border/60 from-background to-background/80 bg-gradient-to-br shadow-sm'>
      <CardHeader className='p-3 pb-1'>
        <CardTitle className='text-muted-foreground flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase'>
          {label}
          {sub && (
            <span className='ml-auto text-[9px] font-normal normal-case opacity-60'>
              {sub}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='p-3 pt-1'>
        <div className='truncate text-lg leading-tight font-semibold'>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className='bg-card/30 flex h-40 flex-col justify-between rounded-lg border p-4'>
      <div className='mb-2 text-sm font-medium'>{title}</div>
      <div className='text-muted-foreground text-xs'>Coming soon…</div>
    </div>
  );
}
