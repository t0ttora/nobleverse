'use client';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useTransition, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  IconShare,
  IconQrcode,
  IconDotsVertical,
  IconDownload
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@/components/ui/popover';
import domtoimage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    created: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    in_transit: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    disputed: 'bg-red-500/10 text-red-600 border-red-500/30'
  };
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium',
        map[status] || 'bg-muted text-muted-foreground'
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

interface ProfileMini {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function AvatarStack({ participantIds }: { participantIds: string[] }) {
  const [profiles, setProfiles] = useState<ProfileMini[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!participantIds.length) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .in('id', participantIds.slice(0, 8));
      if (active) setProfiles(data || []);
      const roleMap: Record<string, string> = {};
      data?.forEach((p) => {
        roleMap[p.id] = (p as any).role || '';
      });
      if (active) setRoles(roleMap);
    })();
    return () => {
      active = false;
    };
  }, [participantIds.join('|')]);
  const shown = profiles.slice(0, 4);
  const extra = participantIds.length - shown.length;
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>
        <div className='flex cursor-pointer items-center -space-x-2'>
          {shown.map((p) => {
            const initials = (p.display_name || p.username || p.id)
              .split(/\s+/)
              .map((s) => s[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <Avatar
                key={p.id}
                className='ring-background bg-muted/30 h-9 w-9 border shadow-sm ring-2 backdrop-blur'
              >
                {p.avatar_url && (
                  <AvatarImage
                    src={p.avatar_url}
                    alt={p.display_name || p.username || ''}
                  />
                )}
                <AvatarFallback className='text-[10px] font-medium'>
                  {initials}
                </AvatarFallback>
              </Avatar>
            );
          })}
          {extra > 0 && (
            <div className='bg-muted ring-background flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-medium shadow-sm ring-2'>
              +{extra}
            </div>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side='bottom' align='end' className='w-56 p-3'>
        <div className='mb-2 text-xs font-medium'>Participants</div>
        <ul className='space-y-1 text-xs'>
          {profiles.map((p) => (
            <li key={p.id} className='flex items-center gap-2'>
              <Avatar className='bg-muted/40 h-6 w-6 border'>
                {p.avatar_url && (
                  <AvatarImage src={p.avatar_url} alt={p.display_name || ''} />
                )}
                <AvatarFallback className='text-[10px]'>
                  {(p.display_name || p.username || p.id)
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-[11px] font-medium'>
                  {p.display_name || p.username || p.id.slice(0, 8)}
                </div>
                <div className='text-muted-foreground text-[10px]'>
                  {roles[p.id] || 'participant'}
                </div>
              </div>
            </li>
          ))}
          {profiles.length === 0 && (
            <li className='text-muted-foreground text-[11px]'>
              No participants
            </li>
          )}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

interface ShipmentHeaderProps {
  shipment: any;
  onShare?: () => Promise<string>;
  progress?: number;
  milestoneTotal?: number;
  mobileToggle?: React.ReactNode;
}

export default function ShipmentHeader({
  shipment,
  onShare,
  progress,
  milestoneTotal,
  mobileToggle
}: ShipmentHeaderProps) {
  const [pendingLabel, startLabel] = useTransition();
  const [shareLoading, setShareLoading] = useState(false);
  const [labelData, setLabelData] = useState<{ token?: string }>({});
  const [exporting, setExporting] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const created = shipment.created_at
    ? format(new Date(shipment.created_at), 'MMM d, yyyy')
    : '—';
  const participants: string[] = Array.isArray(shipment.participants)
    ? shipment.participants
    : [];

  const handleGenerateLabel = () => {
    startLabel(async () => {
      try {
        const r = await fetch(`/api/shipments/${shipment.id}/label`, {
          method: 'POST'
        });
        if (!r.ok) throw new Error('Failed');
        const j = await r.json().catch(() => ({}));
        setLabelData({ token: j.token });
        toast.success('Label ready');
      } catch (e: any) {
        toast.error(e.message || 'Label failed');
      }
    });
  };

  // Ensure a token & DOM ready for export (uses hidden label below)
  const ensureLabelReady = async () => {
    if (labelData.token && labelRef.current) return;
    // generate token if needed
    if (!labelData.token) {
      try {
        const r = await fetch(`/api/shipments/${shipment.id}/label`, {
          method: 'POST'
        });
        if (!r.ok) throw new Error('Label generation failed');
        const j = await r.json().catch(() => ({}));
        setLabelData({ token: j.token });
      } catch (e: any) {
        toast.error(e.message || 'Label error');
        throw e;
      }
    }
    // wait next frame for hidden label to render
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  };

  const exportPNG = async () => {
    try {
      setExporting(true);
      await ensureLabelReady();
      if (!labelRef.current) return;
      const dataUrl = await domtoimage.toPng(labelRef.current as any, {
        bgcolor: '#ffffff'
      });
      triggerDownload(dataUrl, `${shipment.code || shipment.id}-label.png`);
    } catch {
    } finally {
      setExporting(false);
    }
  };
  const exportJPG = async () => {
    try {
      setExporting(true);
      await ensureLabelReady();
      if (!labelRef.current) return;
      const dataUrl = await domtoimage.toJpeg(labelRef.current as any, {
        bgcolor: '#ffffff',
        quality: 0.92
      });
      triggerDownload(dataUrl, `${shipment.code || shipment.id}-label.jpg`);
    } catch {
    } finally {
      setExporting(false);
    }
  };
  const exportPDF = async () => {
    try {
      setExporting(true);
      await ensureLabelReady();
      if (!labelRef.current) return;
      const node = labelRef.current as any;
      const dataUrl = await domtoimage.toPng(node, { bgcolor: '#ffffff' });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });
      const w = img.width;
      const h = img.height;
      const pdf = new jsPDF({
        orientation: h > w ? 'portrait' : 'landscape',
        unit: 'pt',
        format: [w, h]
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
      pdf.save(`${shipment.code || shipment.id}-label.pdf`);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  const exportZPL = async () => {
    try {
      setExporting(true);
      await ensureLabelReady();
      const shipCode = shipment.code || shipment.id.slice(0, 8);
      const tracking = labelData.token || 'TRACK';
      const origin = (shipment.origin || '-').toString().slice(0, 24);
      const destination = (shipment.destination || '-').toString().slice(0, 24);
      const status = (shipment.status || '')
        .toString()
        .replace(/_/g, ' ')
        .toUpperCase()
        .slice(0, 20);
      const eta = shipment.eta
        ? format(new Date(shipment.eta), 'dd MMM yyyy')
        : '-';
      // Basic 4x6 label (812 x 1218 dots at 203dpi); using ^CI28 for UTF-8 safety fallback
      const zpl = [
        '^XA',
        '^CI28',
        '^PW812',
        '^LH20,20',
        '^CF0,40',
        `^FO0,0^FDNobleVerse^FS`,
        '^CF0,28',
        `^FO0,60^FDShipment:${shipCode}^FS`,
        `^FO0,100^FDTracking:${tracking}^FS`,
        `^FO0,140^FDFrom:${origin}^FS`,
        `^FO0,180^FDTo:${destination}^FS`,
        `^FO0,220^FDStatus:${status}^FS`,
        `^FO0,260^FDETA:${eta}^FS`,
        // QR (Model 2 auto, size 6) encoding share stub with token
        `^FO500,40^BQN,2,6^FDLA,${tracking}^FS`,
        // Code128 barcode
        `^BY2,3,80`,
        `^FO0,320^BCN,80,Y,N,N^FD${tracking}^FS`,
        '^CF0,24',
        `^FO0,420^FDSupport:nobleverse.co/s/${tracking}^FS`,
        '^XZ'
      ].join('\n');
      const blob = new Blob([zpl], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shipCode}-label.zpl`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  function triggerDownload(dataUrl: string, filename: string) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataUrl;
    a.click();
  }

  const handleShare = async () => {
    if (!onShare) return;
    setShareLoading(true);
    try {
      const url = await onShare();
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch (e: any) {
      toast.error(e.message || 'Share link failed');
    } finally {
      setShareLoading(false);
    }
  };

  // Static inline milestone preview placeholder until real timeline condenses
  const milestonePreview = (shipment.milestone_codes ||
    shipment.milestones ||
    []) as any[];
  const inlineMilestones = milestonePreview.slice(0, 4);

  const pct = Math.min(
    100,
    Math.max(
      0,
      progress ??
        (shipment.milestone_count
          ? (shipment.milestone_count /
              (milestoneTotal || Math.max(4, shipment.milestone_count))) *
            100
          : 0)
    )
  );

  // Short display version of tracking token (full preserved elsewhere)
  const shortToken = (t?: string) => {
    if (!t) return '—';
    return t.length > 14 ? `${t.slice(0, 6)}…${t.slice(-4)}` : t;
  };
  const displayTracking = shortToken(labelData.token);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className='bg-background/85 supports-[backdrop-filter]:bg-background/70 relative flex w-full flex-col gap-2 border-b px-4 py-2.5 backdrop-blur md:px-5 md:py-3'>
      {mounted &&
        labelOpen &&
        createPortal(
          <div
            className='fixed inset-0 z-[55] bg-black/40'
            onClick={() => setLabelOpen(false)}
            aria-hidden='true'
          />,
          document.body
        )}
      <div className='flex flex-wrap items-start gap-3 md:gap-4'>
        <div className='flex min-w-0 flex-1 flex-col gap-1 md:flex-initial'>
          <h1 className='truncate text-lg leading-tight font-semibold tracking-tight md:text-xl'>
            {shipment.code || shipment.id.slice(0, 8)}
          </h1>
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[11px] md:gap-3 md:text-xs'>
            {shipment.origin && shipment.destination && (
              <span className='text-foreground/80 font-medium'>
                {shipment.origin} → {shipment.destination}
              </span>
            )}
            <StatusPill status={shipment.status} />
            <span className='bg-muted rounded px-2 py-0.5 text-[11px]'>
              Escrow {shipment.escrow_status}
            </span>
            {shipment.total_amount_cents != null && (
              <span className='bg-foreground text-background rounded px-2 py-0.5 text-[12px] font-semibold shadow-sm md:text-[13px]'>
                ${(shipment.total_amount_cents / 100).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        {mobileToggle && (
          <div className='order-3 flex w-full items-center gap-2 md:hidden'>
            {mobileToggle}
          </div>
        )}
        <div className='order-2 ml-auto flex items-center gap-1.5 md:order-none md:gap-2'>
          <AvatarStack
            participantIds={
              participants.length
                ? participants
                : [shipment.owner_id, shipment.forwarder_id].filter(Boolean)
            }
          />
          <Popover open={labelOpen} onOpenChange={setLabelOpen}>
            <PopoverTrigger asChild>
              <Button
                size='icon'
                variant='outline'
                disabled={pendingLabel}
                onClick={!labelData.token ? handleGenerateLabel : undefined}
                className='h-8 w-8'
              >
                <IconQrcode className='h-4 w-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align='end'
              className='z-[70] w-[calc(100vw-2rem)] max-w-[560px] overflow-visible p-0'
            >
              <div className='flex flex-col gap-4 p-5'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='space-y-1'>
                    <h4 className='text-sm leading-tight font-semibold'>
                      Shipping Label
                    </h4>
                    <p className='text-muted-foreground max-w-[260px] text-xs'>
                      Scan QR or barcode to register scans & retrieve live
                      status.
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size='icon'
                        variant='outline'
                        className='h-8 w-8'
                        disabled={exporting}
                        title='Download / Export'
                      >
                        <IconDownload className='h-5 w-5' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end' className='z-[80] w-44'>
                      <DropdownMenuLabel>Export</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={exportPNG}
                        disabled={exporting}
                      >
                        {exporting ? '…' : 'PNG'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={exportJPG}
                        disabled={exporting}
                      >
                        {exporting ? '…' : 'JPEG'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={exportPDF}
                        disabled={exporting}
                      >
                        {exporting ? '…' : 'PDF'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={exportZPL}
                        disabled={exporting}
                      >
                        {exporting ? '…' : 'ZPL'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div
                  className='max-w-full space-y-4 rounded-md border bg-white p-5 text-neutral-900 shadow-sm'
                  style={{
                    fontFamily: 'ui-monospace,monospace',
                    printColorAdjust: 'exact' as any
                  }}
                >
                  <div className='flex items-start justify-between'>
                    <div
                      className='flex items-center justify-center rounded border bg-white p-1'
                      style={{ width: 72, height: 72 }}
                    >
                      <img
                        src='/logomark.svg'
                        alt='NobleVerse'
                        className='h-14 w-14 object-contain'
                      />
                    </div>
                    <div className='rounded border bg-white p-1'>
                      <SimpleQR
                        value={(labelData.token || shipment.id).slice(0, 64)}
                        size={72}
                      />
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] leading-relaxed break-words md:text-[12px]'>
                    <LabelRow
                      k='Shipment ID'
                      v={shipment.code || shipment.id.slice(0, 8)}
                    />
                    <LabelRow
                      k='Tracking No'
                      v={displayTracking.toUpperCase()}
                      full={labelData.token || undefined}
                    />
                    <LabelRow k='Origin' v={shipment.origin || '—'} />
                    <LabelRow k='Destination' v={shipment.destination || '—'} />
                    <LabelRow
                      k='Forwarder'
                      v={
                        shipment.forwarder_name ||
                        shipment.forwarder_id?.slice(0, 8) ||
                        '—'
                      }
                    />
                    <LabelRow
                      k='Shipper'
                      v={
                        shipment.owner_name ||
                        shipment.owner_id?.slice(0, 8) ||
                        '—'
                      }
                    />
                    <LabelRow
                      k='Status'
                      v={shipment.status?.replace(/_/g, ' ').toUpperCase()}
                    />
                    <LabelRow
                      k='ETA'
                      v={
                        shipment.eta
                          ? format(new Date(shipment.eta), 'dd MMM yyyy')
                          : '—'
                      }
                    />
                  </div>
                  <div className='mt-1'>
                    <SimpleBarcode
                      value={
                        (labelData.token || shipment.id)
                          .replace(/[^A-Z0-9]/gi, '')
                          .slice(0, 32) || 'NV'
                      }
                      height={50}
                    />
                  </div>
                  <div className='mt-2 flex items-center justify-between border-t pt-1 text-[10px]'>
                    <span>
                      Support: nobleverse.co/s/{labelData.token || 'XXXX'}
                    </span>
                    <span className='opacity-60'>Print v1</span>
                  </div>
                </div>
                {/* Removed footer note for symmetrical padding */}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size='sm'
            variant='secondary'
            onClick={handleShare}
            disabled={shareLoading}
            className='flex h-8 items-center gap-1'
          >
            <IconShare className='h-4 w-4' />{' '}
            <span className='hidden sm:inline md:inline'>
              {shareLoading ? 'Link…' : 'Share'}
            </span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <IconDotsVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-40'>
              <DropdownMenuItem onClick={handleShare} className='gap-2'>
                <IconShare className='h-4 w-4' /> Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGenerateLabel} className='gap-2'>
                <IconQrcode className='h-4 w-4' /> New Label Token
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className='bg-border h-1 w-full overflow-hidden rounded'>
        <div
          className='h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400'
          style={{ width: pct + '%' }}
        />
      </div>
      {/* Hidden label for export (always in DOM) */}
      <div className='absolute top-0 -left-[9999px]' aria-hidden='true'>
        <div
          ref={labelRef}
          className='export-label w-[520px] space-y-4 rounded-md border bg-white p-5 text-neutral-900 shadow-sm'
          style={{ fontFamily: 'ui-monospace,monospace' }}
        >
          <div className='flex items-start justify-between'>
            <div
              className='flex items-center justify-center rounded border bg-white p-1'
              style={{ width: 72, height: 72 }}
            >
              <img
                src='/logomark.svg'
                alt='NobleVerse'
                className='h-14 w-14 object-contain'
              />
            </div>
            <div className='rounded border bg-white p-1'>
              <SimpleQR
                value={(labelData.token || shipment.id).slice(0, 64)}
                size={72}
              />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] leading-relaxed break-words'>
            <LabelRow
              k='Shipment ID'
              v={shipment.code || shipment.id.slice(0, 8)}
            />
            <LabelRow
              k='Tracking No'
              v={(labelData.token || '—').toUpperCase()}
            />
            <LabelRow k='Origin' v={shipment.origin || '—'} />
            <LabelRow k='Destination' v={shipment.destination || '—'} />
            <LabelRow
              k='Forwarder'
              v={
                shipment.forwarder_name ||
                shipment.forwarder_id?.slice(0, 8) ||
                '—'
              }
            />
            <LabelRow
              k='Shipper'
              v={shipment.owner_name || shipment.owner_id?.slice(0, 8) || '—'}
            />
            <LabelRow
              k='Status'
              v={shipment.status?.replace(/_/g, ' ').toUpperCase()}
            />
            <LabelRow
              k='ETA'
              v={
                shipment.eta
                  ? format(new Date(shipment.eta), 'dd MMM yyyy')
                  : '—'
              }
            />
          </div>
          <div className='mt-1'>
            <SimpleBarcode
              value={
                (labelData.token || shipment.id)
                  .replace(/[^A-Z0-9]/gi, '')
                  .slice(0, 32) || 'NV'
              }
              height={46}
            />
          </div>
          <div className='mt-2 flex items-center justify-between border-t pt-1 text-[10px]'>
            <span>Support: nobleverse.co/s/{labelData.token || 'XXXX'}</span>
            <span className='opacity-60'>Print v1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components for label rendering
function LabelRow({ k, v, full }: { k: string; v: string; full?: string }) {
  const title = full && full !== v ? full : undefined;
  return (
    <div className='flex min-w-0 items-start gap-2'>
      <span className='font-semibold whitespace-nowrap'>{k}:</span>
      <span
        className='max-w-[200px] text-[11px] leading-snug break-words md:text-[12px]'
        title={title}
      >
        {v || '—'}
      </span>
    </div>
  );
}

// Minimal QR: simple matrix using deterministic hash (not standard error correction, placeholder until lib added)
function SimpleQR({ value, size = 80 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');
    if (!ctx) return;
    const cells = 25; // fixed grid
    const cell = size / cells;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    // hash -> bits
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (h * 31 + value.charCodeAt(i)) >>> 0;
    }
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const bit =
          (h ^
            ((x + 1) * 1103515245) ^
            ((y + 1) * 12345) ^
            ((x * y + 7) << 3)) &
          1;
        if (bit) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
    // Quiet zone
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [value, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

function SimpleBarcode({
  value,
  height = 48
}: {
  value: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');
    if (!ctx) return;
    const w = ref.current.width;
    ctx.clearRect(0, 0, w, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, height);
    // Simple Code39-like pattern (not spec compliant, placeholder)
    const patternBits = [] as number[];
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      for (let b = 0; b < 7; b++) patternBits.push((c >> b) & 1 ? 3 : 1, 1); // bar width + gap
    }
    let x = 4;
    ctx.fillStyle = '#000';
    for (let i = 0; i < patternBits.length && x < w - 4; i += 2) {
      const bar = patternBits[i];
      ctx.fillRect(x, 4, bar, height - 12);
      x += bar + (patternBits[i + 1] || 1);
    }
    ctx.font = '10px monospace';
    ctx.fillText(value, 6, height - 2);
  }, [value, height]);
  return <canvas ref={ref} width={360} height={height} className='w-full' />;
}
