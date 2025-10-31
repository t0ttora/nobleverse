'use client';
import { ShipmentHeader, MilestonesPanel, EscrowPanel } from './';
import { DocumentsTab, TrackingTab } from './tabs';
import { RealtimeChat } from '@/components/realtime-chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
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
  const initialRatio = (() => {
    try {
      const raw = localStorage.getItem('nv_ship_left_ratio');
      if (raw) return Math.min(0.7, Math.max(0.25, Number(raw)));
    } catch {}
    return 0.44;
  })();
  const ratioRef = useRef<number>(initialRatio);
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
  // Restore persisted active tab and mobile view
  useEffect(() => {
    try {
      const t = localStorage.getItem(`nv_ship_active_tab:${shipment.id}`);
      if (
        t &&
        ['overview', 'tracking', 'docs', 'finance', 'settings'].includes(t)
      ) {
        setActiveTab(t as TabKey);
      }
      const mv = localStorage.getItem('nv_ship_mobile_view');
      if (mv === 'chat' || mv === 'details') setMobileView(mv as any);
    } catch {}
  }, [shipment.id]);
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
    const min = rect.width < 1100 ? 360 : 420;
    const maxRightMin = rect.width < 1100 ? 420 : 520; // ensure right panel min width
    const max = Math.min(rect.width - maxRightMin, 980);
    let w = e.clientX - rect.left;
    if (w < min) w = min;
    if (w > max) w = max;
    setLeftWidth(w);
  }, []);
  const stop = useCallback(() => {
    isResizing.current = false;
    // persist ratio
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0.25, Math.min(0.7, leftWidth / rect.width));
      ratioRef.current = ratio;
      try {
        localStorage.setItem('nv_ship_left_ratio', String(ratio));
      } catch {}
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stop);
  }, [onMouseMove, leftWidth]);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
  };

  // Set an initial width and keep it responsive on window resize
  useEffect(() => {
    function apply() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const min = rect.width < 1100 ? 360 : 420;
      const maxRightMin = rect.width < 1100 ? 420 : 520;
      const max = Math.min(rect.width - maxRightMin, 980);
      const target = Math.round(
        Math.min(max, Math.max(min, ratioRef.current * rect.width))
      );
      setLeftWidth(target);
    }
    apply();
    const onResize = () => {
      if (isResizing.current) return;
      apply();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
                onClick={() => {
                  setMobileView('chat');
                  try {
                    localStorage.setItem('nv_ship_mobile_view', 'chat');
                  } catch {}
                }}
                className='h-7 px-3 text-[11px] leading-none'
              >
                Chat
              </Button>
              <Button
                variant={mobileView === 'details' ? 'default' : 'outline'}
                size='sm'
                onClick={() => {
                  setMobileView('details');
                  try {
                    localStorage.setItem('nv_ship_mobile_view', 'details');
                  } catch {}
                }}
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
          className='hidden flex-col overflow-hidden md:flex'
          style={{ width: leftWidth }}
        >
          <div className='flex h-full flex-col'>
            <div className='flex flex-1 flex-col overflow-hidden'>
              <div className='flex flex-1 flex-col'>
                <RealtimeChat
                  roomName={shipment.id}
                  nobleId={currentUserId.slice(0, 6)}
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
            <div className='bg-background flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l'>
              <Tabs
                value={activeTab}
                onValueChange={(v: any) => {
                  setActiveTab(v);
                  try {
                    localStorage.setItem(
                      `nv_ship_active_tab:${shipment.id}`,
                      String(v)
                    );
                  } catch {}
                }}
                className='flex flex-1 flex-col overflow-hidden'
              >
                <div className='px-3 pt-4 md:pt-6'>
                  <TabsList className='scrollbar-thin mt-1 w-full justify-start overflow-x-auto'>
                    <TabsTrigger value='overview'>Overview</TabsTrigger>
                    <TabsTrigger value='tracking'>
                      Tracking & Milestones
                    </TabsTrigger>
                    <TabsTrigger value='docs'>Docs</TabsTrigger>
                    <TabsTrigger value='finance'>Finance</TabsTrigger>
                    <TabsTrigger value='settings'>Settings</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent
                  value='overview'
                  className='flex-1 space-y-4 overflow-auto p-3 md:p-4'
                >
                  <OverviewTab
                    shipment={shipment}
                    total={total}
                    fee={fee}
                    net={net}
                    goToFinance={() => setActiveTab('finance')}
                  />
                </TabsContent>
                <TabsContent
                  value='tracking'
                  className='flex-1 space-y-4 overflow-auto p-3 md:p-4'
                >
                  <TrackingTab
                    shipmentId={shipment.id}
                    ownerId={shipment.owner_id}
                    forwarderId={shipment.forwarder_id}
                    currentUserId={currentUserId}
                  />
                </TabsContent>
                <TabsContent
                  value='docs'
                  className='flex-1 space-y-4 overflow-auto p-3 md:p-4'
                >
                  <DocumentsTab shipment={shipment} />
                </TabsContent>
                <TabsContent
                  value='finance'
                  className='flex-1 space-y-4 overflow-auto p-3 md:p-4'
                >
                  <FinancialTab
                    shipment={shipment}
                    total={total}
                    fee={fee}
                    net={net}
                    goToDocs={() => setActiveTab('docs')}
                  />
                </TabsContent>
                <TabsContent
                  value='settings'
                  className='flex-1 space-y-4 overflow-auto p-3 md:p-4'
                >
                  <SettingsTab shipment={shipment} />
                </TabsContent>
              </Tabs>
            </div>
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
                nobleId={currentUserId.slice(0, 6)}
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
                onValueChange={(v: any) => {
                  setActiveTab(v);
                  try {
                    localStorage.setItem(
                      `nv_ship_active_tab:${shipment.id}`,
                      String(v)
                    );
                  } catch {}
                }}
                className='flex flex-1 flex-col overflow-hidden'
              >
                <TabsList className='scrollbar-thin w-full justify-start overflow-x-auto px-1'>
                  <TabsTrigger value='overview'>Overview</TabsTrigger>
                  <TabsTrigger value='tracking'>
                    Tracking & Milestones
                  </TabsTrigger>
                  <TabsTrigger value='docs'>Docs</TabsTrigger>
                  <TabsTrigger value='finance'>Finance</TabsTrigger>
                  <TabsTrigger value='settings'>Settings</TabsTrigger>
                </TabsList>
                <TabsContent
                  value='overview'
                  className='flex-1 space-y-3 overflow-auto p-2.5'
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
                  className='flex-1 space-y-3 overflow-auto p-2.5'
                >
                  <TrackingTab
                    shipmentId={shipment.id}
                    ownerId={shipment.owner_id}
                    forwarderId={shipment.forwarder_id}
                    currentUserId={currentUserId}
                  />
                </TabsContent>
                <TabsContent
                  value='docs'
                  className='flex-1 space-y-3 overflow-auto p-2.5'
                >
                  <DocumentsTab shipment={shipment} />
                </TabsContent>
                <TabsContent
                  value='finance'
                  className='flex-1 space-y-3 overflow-auto p-2.5'
                >
                  <FinancialTab
                    shipment={shipment}
                    total={total}
                    fee={fee}
                    net={net}
                    goToDocs={() => setActiveTab('docs')}
                  />
                </TabsContent>
                <TabsContent
                  value='settings'
                  className='flex-1 space-y-3 overflow-auto p-2.5'
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

type TabKey = 'overview' | 'tracking' | 'docs' | 'finance' | 'settings';

// Removed custom TabsHeader in favor of shadcn Tabs

function OverviewTab({
  shipment,
  total,
  fee,
  net,
  goToFinance
}: {
  shipment: any;
  total: number;
  fee: number;
  net: number;
  goToFinance?: () => void;
}) {
  return (
    <div className='space-y-4'>
      {/* Bento Grid */}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'>
        {/* Shipment Status Stepper */}
        <Card className='md:col-span-2'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Shipment Status</CardTitle>
          </CardHeader>
          <CardContent className='p-3'>
            <StatusStepper status={shipment.status} />
          </CardContent>
        </Card>

        {/* Finance Summary */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Finance Summary</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 p-3 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Net Amount</span>
              <span className='font-semibold'>${net.toFixed(2)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Status</span>
              <span className='capitalize'>
                {(shipment.escrow_status || '').replace(/_/g, ' ')}
              </span>
            </div>
            <div className='pt-1'>
              <Button
                variant='link'
                className='px-0'
                onClick={() => goToFinance?.()}
              >
                View Details →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Key Info (merged) */}
        <Card className='sm:col-span-2 md:col-span-3'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Key Info</CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-1 gap-3 p-3 text-xs sm:grid-cols-2 md:grid-cols-3'>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Origin</div>
              <div className='font-medium'>{shipment.origin || '—'}</div>
            </div>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Destination</div>
              <div className='font-medium'>{shipment.destination || '—'}</div>
            </div>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Mode</div>
              <div className='font-medium'>{shipment.mode || '—'}</div>
            </div>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Incoterm</div>
              <div className='font-medium'>{shipment.incoterm || '—'}</div>
            </div>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Owner</div>
              <div className='font-medium'>
                {shipment.owner_id?.slice(0, 8) || '—'}
              </div>
            </div>
            <div className='space-y-1'>
              <div className='text-muted-foreground'>Forwarder</div>
              <div className='font-medium'>
                {shipment.forwarder_id?.slice(0, 8) || '—'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// TrackingTab UI is implemented in ./tabs/tracking-tab

// DocumentsTab is now imported from './tabs/documents-tab'

function FinancialTab({
  shipment,
  total,
  fee,
  net,
  goToDocs
}: {
  shipment: any;
  total: number;
  fee: number;
  net: number;
  goToDocs?: () => void;
}) {
  const escrowState = String(shipment.escrow_status || '').replace(/_/g, ' ');
  return (
    <div className='space-y-4'>
      {/* Top summary KPIs */}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4'>
        <KpiCard label='Total' value={`$${total.toFixed(2)}`} sub='Gross' />
        <KpiCard label='Fees' value={`$${fee.toFixed(2)}`} sub='Platform' />
        <KpiCard label='Net' value={`$${net.toFixed(2)}`} sub='To Forwarder' />
        <KpiCard label='Escrow' value={escrowState} sub='State' />
      </div>

      {/* Main content grid: Ledger + Actions */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        {/* Ledger (wide) */}
        <div className='lg:col-span-2'>
          <EscrowLedgerTable shipmentId={shipment.id} />
        </div>

        {/* Actions & Summary */}
        <Card className='rounded-lg border'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Escrow</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 p-3'>
            <div className='text-muted-foreground text-xs'>
              Current status: <span className='capitalize'>{escrowState}</span>
            </div>
            <div className='rounded-md border'>
              <EscrowPanel shipment={shipment} />
            </div>
            <div className='text-muted-foreground text-[11px]'>
              Payment is released to the forwarder once delivered, or can be
              manually released here if both parties agree.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices & Payments summaries */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <InvoicesPanel shipmentId={shipment.id} onOpenDocs={goToDocs} />
        <PaymentsPanel shipmentId={shipment.id} />
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
  const [shareUrl, setShareUrl] = useState<string>('');
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
  const createShare = async () => {
    setLoading('create-share');
    try {
      const r = await fetch(`/api/shipments/${shipment.id}/share`, {
        method: 'POST'
      });
      if (r.ok) {
        const j = await r.json();
        setShareUrl(j.url || '');
      }
    } finally {
      setLoading(null);
    }
  };
  const disableLinks = async () => {
    if (!confirm('Disable all active public share links?')) return;
    setLoading('disable-links');
    try {
      await fetch(`/api/shipments/${shipment.id}/share`, { method: 'DELETE' });
      setShareUrl('');
    } finally {
      setLoading(null);
    }
  };
  return (
    <div className='space-y-4'>
      {/* Status Controls */}
      <Card className='rounded-lg border'>
        <CardHeader className='pb-1'>
          <CardTitle className='text-sm'>Shipment Controls</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 p-3 text-xs'>
          <div className='text-muted-foreground'>
            Force a status when testing or resolving issues.
          </div>
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
              {loading === 'in_transit' ? '…' : 'Force In-Transit'}
            </Button>
            <Button size='sm' variant='destructive' disabled>
              Close Dispute
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sharing */}
      <Card className='rounded-lg border'>
        <CardHeader className='pb-1'>
          <CardTitle className='text-sm'>Sharing</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 p-3 text-xs'>
          <div className='text-muted-foreground'>
            Create a public share link to allow read-only tracking.
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              size='sm'
              onClick={createShare}
              disabled={loading === 'create-share'}
            >
              {loading === 'create-share' ? 'Creating…' : 'Create Share Link'}
            </Button>
            <Button
              size='sm'
              variant='destructive'
              disabled={loading === 'disable-links'}
              onClick={disableLinks}
            >
              {loading === 'disable-links' ? 'Working…' : 'Disable All Links'}
            </Button>
          </div>
          {shareUrl && (
            <div className='flex items-center gap-2'>
              <input
                readOnly
                value={shareUrl}
                className='w-full rounded-md border bg-transparent px-2 py-1 text-xs'
              />
              <Button
                size='sm'
                variant='outline'
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className='rounded-lg border'>
        <CardHeader className='pb-1'>
          <CardTitle className='text-sm'>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 p-3 text-xs'>
          <div className='text-muted-foreground'>
            Irreversible or sensitive actions.
          </div>
          <Button size='sm' variant='destructive' disabled>
            Archive Shipment (coming soon)
          </Button>
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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [q, setQ] = useState<string>('');
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
  const filtered = rows.filter((r) => {
    const typeOk = typeFilter === 'all' || r.entry_type === typeFilter;
    const txt = q.trim().toLowerCase();
    if (!txt) return typeOk;
    const meta = JSON.stringify(r.meta || {}).toLowerCase();
    return (
      typeOk &&
      (meta.includes(txt) || String(r.entry_type).toLowerCase().includes(txt))
    );
  });

  const total =
    filtered.reduce(
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
        <div className='flex items-center justify-between gap-2 px-3 py-2'>
          <div className='text-[11px]'>
            Entries: <span className='font-medium'>{filtered.length}</span>
          </div>
          <div className='flex items-center gap-2'>
            <select
              className='rounded-md border bg-transparent px-2 py-1 text-xs'
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value='all'>All</option>
              <option value='RELEASE'>Release</option>
              <option value='REFUND'>Refund</option>
              <option value='FEE'>Fee</option>
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Search meta'
              className='rounded-md border bg-transparent px-2 py-1 text-xs'
            />
          </div>
        </div>
        <div className='max-h-64 overflow-auto border-t'>
          <table className='min-w-full border-collapse text-xs'>
            <thead className='bg-muted/40 sticky top-0 z-10 text-[10px] tracking-wide uppercase'>
              <tr className='text-left'>
                <th className='px-3 py-2 font-medium'>Time</th>
                <th className='px-3 py-2 font-medium'>Type</th>
                <th className='px-3 py-2 font-medium'>Meta</th>
                <th className='px-3 py-2 text-right font-medium'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
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
                    <td className='px-3 py-2 whitespace-nowrap'>
                      {new Date(r.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className='px-3 py-2'>{r.entry_type}</td>
                    <td
                      className='max-w-[160px] truncate px-3 py-2'
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
                    <td className={'px-3 py-2 text-right font-medium ' + cls}>
                      {sign.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className='px-3 py-4'>
                    <EmptyState
                      title='No entries'
                      subtitle='Escrow activity will appear here.'
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex justify-end gap-2 border-t px-3 py-2 text-[11px]'>
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

function InvoicesPanel({
  shipmentId,
  onOpenDocs
}: {
  shipmentId: string;
  onOpenDocs?: () => void;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('shipments')
          .list(shipmentId, {
            limit: 200,
            sortBy: { column: 'name', order: 'asc' } as any
          });
        if (!mounted) return;
        if (error) throw error;
        setFiles(data || []);
      } catch {
        setFiles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [shipmentId]);
  function isInvoiceName(name: string) {
    const s = name.toLowerCase();
    return /(invoice|inv_|inv\.|receipt|bill|commercial_invoice)/.test(s);
  }
  const invoices = files
    .filter((f) => typeof f.name === 'string' && isInvoiceName(f.name))
    .slice(0, 8);
  const getUrl = (name: string) =>
    supabase.storage.from('shipments').getPublicUrl(`${shipmentId}/${name}`)
      .data.publicUrl;
  return (
    <Card className='rounded-lg border lg:col-span-2'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='text-sm'>Invoices</CardTitle>
        {onOpenDocs && (
          <Button
            size='sm'
            variant='link'
            className='px-0 text-xs'
            onClick={onOpenDocs}
          >
            Open in Docs →
          </Button>
        )}
      </CardHeader>
      <CardContent className='p-3'>
        {loading && (
          <div className='text-muted-foreground text-xs'>Loading…</div>
        )}
        {!loading && invoices.length === 0 && (
          <EmptyState
            title='No invoices found'
            subtitle='Upload invoices under Docs to see them here.'
            action={
              onOpenDocs ? (
                <Button size='sm' onClick={onOpenDocs}>
                  Go to Docs
                </Button>
              ) : undefined
            }
          />
        )}
        {!loading && invoices.length > 0 && (
          <div className='space-y-2'>
            {invoices.map((f) => (
              <div
                key={f.name}
                className='flex items-center justify-between rounded-md border p-2 text-xs'
              >
                <div className='min-w-0 truncate' title={f.name}>
                  {f.name}
                </div>
                <div className='flex items-center gap-2'>
                  <div className='opacity-60'>
                    {f.updated_at
                      ? new Date(f.updated_at).toLocaleDateString()
                      : ''}
                  </div>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => window.open(getUrl(f.name), '_blank')}
                  >
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsPanel({ shipmentId }: { shipmentId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase
        .from('escrow_ledger')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
        .limit(20);
      setRows(data || []);
      sub = supabase
        .channel(`realtime:escrow_summary:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'escrow_ledger',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (p: any) => setRows((r) => [p.new, ...r].slice(0, 20))
        )
        .subscribe();
    })();
    return () => {
      sub && supabase.removeChannel(sub);
    };
  }, [shipmentId]);
  const nice = (r: any) => {
    const amt = r.amount_cents / 100;
    const sign = r.entry_type === 'REFUND' ? -amt : amt;
    return sign.toFixed(2);
  };
  return (
    <Card className='rounded-lg border'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm'>Payments</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2 p-3 text-xs'>
        {rows.length === 0 && (
          <EmptyState
            title='No payments yet'
            subtitle='Releases and refunds will show up here.'
          />
        )}
        {rows.slice(0, 8).map((r) => (
          <div
            key={r.id}
            className='flex items-center justify-between rounded-md border p-2'
          >
            <div className='flex items-center gap-2'>
              <span className='bg-muted/60 rounded px-1.5 py-0.5 text-[10px]'>
                {r.entry_type}
              </span>
              <span className='opacity-70'>
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            <div
              className={
                'font-medium ' +
                (r.entry_type === 'REFUND'
                  ? 'text-red-500'
                  : r.entry_type === 'RELEASE'
                    ? 'text-emerald-600'
                    : 'text-foreground')
              }
            >
              {nice(r)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
    <Card className='rounded-lg border'>
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

// Simple horizontal stepper for shipment status
function StatusStepper({ status }: { status?: string }) {
  const steps = ['Picked Up', 'In Transit', 'Delivered'];
  const idx = (() => {
    const s = String(status || '').toLowerCase();
    if (s.includes('delivered')) return 2;
    if (s.includes('in_transit') || s.includes('transit')) return 1;
    if (s.includes('picked')) return 0;
    return -1; // not started
  })();
  const pct = ((idx + 1) / steps.length) * 100;
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-[11px] md:text-xs'>
        <span className='capitalize'>
          {(status || 'pending').replace(/_/g, ' ')}
        </span>
        <span className='opacity-70'>
          Progress {Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct)).toFixed(0)}
          %
        </span>
      </div>
      <div className='relative h-2 w-full'>
        <div className='bg-muted absolute inset-0 rounded-full' />
        <div
          className='bg-primary/70 absolute top-0 left-0 h-2 rounded-full'
          style={{
            width: `${Math.max(0, Math.min(100, isNaN(pct) ? 0 : pct))}%`
          }}
        />
        <div className='absolute inset-0 flex items-center justify-between px-0.5'>
          {steps.map((_, i) => (
            <span
              key={i}
              className={
                'size-2 rounded-full border ' +
                (idx >= i && idx !== -1
                  ? 'bg-primary border-primary'
                  : 'bg-background border-border')
              }
            />
          ))}
        </div>
      </div>
      {/* Optional: ETA if available in parent scope; kept minimal */}
    </div>
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
