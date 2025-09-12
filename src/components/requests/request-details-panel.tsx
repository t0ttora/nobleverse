'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SidePanel } from '../ui/side-panel';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Package,
  Weight,
  Thermometer,
  AlertTriangle,
  MapPin,
  Calendar,
  DollarSign,
  Maximize2,
  Share2,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icons } from '../icons';
import freightFormSchema from '../../lib/freight_form_schema.json';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { supabase } from '@/lib/supabaseClient';
import {
  getOffersByRequest,
  getOwnOfferForRequest,
  deleteOffer
} from '../../../utils/supabase/offers';
import { useProfileRole } from '@/hooks/use-profile-role';
import {
  ForwarderOfferForm,
  type ForwarderOfferFormHandle
} from '@/components/offers/forwarder-offer-form';
import { CompareOffersPanel } from '@/components/offers/compare-offers';
import { OfferDetailsDialog } from '@/components/offers/offer-details-dialog';

interface RequestDetailsPanelProps {
  open: boolean;
  onClose: () => void;
  request: any | null;
}

function getFreightFormKey(type: string) {
  switch (type) {
    case 'RDF':
      return 'road';
    case 'SEF':
      return 'sea';
    case 'ARF':
      return 'air';
    case 'RAF':
      return 'rail';
    case 'MMF':
      return 'multimodal';
    case 'CRX':
      return 'courier';
    default:
      return undefined;
  }
}

export const RequestDetailsPanel: React.FC<RequestDetailsPanelProps> = ({
  open,
  onClose,
  request
}) => {
  const [tab, setTab] = useState('0');
  const exportRef = useRef<HTMLDivElement>(null);
  const { role } = useProfileRole();
  const [me, setMe] = useState<string>('');
  const [offers, setOffers] = useState<any[]>([]);
  const [actors, setActors] = useState<
    Record<
      string,
      {
        id: string;
        display_name?: string | null;
        username?: string | null;
        avatar_url?: string | null;
      }
    >
  >({});
  const [offerOpen, setOfferOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);
  const [showEmbeddedOffer, setShowEmbeddedOffer] = useState(false);
  const offerFormRef = useRef<ForwarderOfferFormHandle | null>(null);
  const [formState, setFormState] = useState<{
    isFirst: boolean;
    isLast: boolean;
    submitting: boolean;
    step: number;
    currentValid: boolean;
  }>({
    isFirst: true,
    isLast: false,
    submitting: false,
    step: 0,
    currentValid: false
  });
  const [myOffer, setMyOffer] = useState<any | null>(null);
  const [negotiationCounts, setNegotiationCounts] = useState<
    Record<string, number>
  >({});
  // Owner-side filters/sorting for offers tab
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerSort, setOwnerSort] = useState<
    | 'price_asc'
    | 'price_desc'
    | 'transit_asc'
    | 'transit_desc'
    | 'created_desc'
    | 'created_asc'
    | 'company_asc'
    | 'company_desc'
  >('created_desc');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('');
  const [ownerProfile, setOwnerProfile] = useState<{
    id: string;
    username?: string | null;
    company_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null>(null);
  const abbr = request?.freight_type;
  const formKey = getFreightFormKey(abbr);
  const formSchema = formKey ? (freightFormSchema.forms as any)[formKey] : null;
  const details = request?.details || {};

  // Find which sections have at least one field present in details
  const availableSections = useMemo(() => {
    if (!formSchema) return [];
    return formSchema.sections.filter((section: any) =>
      section.fields.some(
        (f: any) =>
          details[f.id] !== undefined &&
          details[f.id] !== null &&
          details[f.id] !== ''
      )
    );
  }, [formSchema, details]);

  // Notes section always last
  const notesSection = formSchema?.notes_section;
  // Cargo Information section (first section)
  const cargoSection = availableSections[0];
  // Only render tabs for sections that are not cargo info or additional notes
  const tabSections = availableSections.filter((section: any, i: number) => {
    if (i === 0 && cargoSection && section.title === cargoSection.title)
      return false;
    if (notesSection && section.title === notesSection.title) return false;
    return true;
  });
  const tabs = [...tabSections.map((section: any) => section.title), 'Offers'];

  // Tab counts for badge
  const tabCounts = [
    ...tabSections.map(
      (section: any) =>
        section.fields.filter(
          (f: any) => details[f.id] !== undefined && details[f.id] !== ''
        ).length
    ),
    offers.length
  ];

  // Additional Notes section (if present)
  const notesFields = notesSection
    ? notesSection.fields.filter(
        (f: any) => details[f.id] !== undefined && details[f.id] !== ''
      )
    : [];

  // IDs of fields shown in summary (cargo info + notes)
  const summaryFieldIds = [
    ...(cargoSection ? cargoSection.fields.map((f: any) => f.id) : []),
    ...(notesSection ? notesSection.fields.map((f: any) => f.id) : [])
  ];
  // Icon map for common cargo fields
  const iconMap: Record<string, React.ReactNode> = {
    cargo_type: <Package className='text-muted-foreground h-4 w-4' />,
    weight: <Weight className='text-muted-foreground h-4 w-4' />,
    volume: <Package className='text-muted-foreground h-4 w-4' />,
    hazardous: <AlertTriangle className='text-muted-foreground h-4 w-4' />,
    temperature_controlled: (
      <Thermometer className='text-muted-foreground h-4 w-4' />
    ),
    origin_city: <MapPin className='text-muted-foreground h-4 w-4' />,
    destination_city: <MapPin className='text-muted-foreground h-4 w-4' />,
    airport_origin: <MapPin className='text-muted-foreground h-4 w-4' />,
    airport_destination: <MapPin className='text-muted-foreground h-4 w-4' />,
    budget: <DollarSign className='text-muted-foreground h-4 w-4' />,
    etd: <Calendar className='text-muted-foreground h-4 w-4' />,
    eta: <Calendar className='text-muted-foreground h-4 w-4' />
  };

  // Remove 'Form' from freight type label
  const freightTypeLabel = (formSchema?.title || abbr)?.replace(
    /\s*Form$/i,
    ''
  );

  // Freight type icon using Icons mapping (dropdown style)
  const freightTypeIcon = (() => {
    const map: Record<string, keyof typeof Icons> = {
      ARF: 'air',
      SEF: 'sea',
      RAF: 'rail',
      MMF: 'multimodal',
      CRX: 'courier',
      RDF: 'road'
    };
    const iconKey = map[abbr] || 'box';
    const IconComp = Icons[iconKey];
    return IconComp ? (
      <IconComp size={16} stroke={1.7} className='text-primary mr-1' />
    ) : null;
  })();

  useEffect(() => {
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setMe(user?.id || '');
    })();
  }, []);

  useEffect(() => {
    if (!request?.id) return;
    (async () => {
      try {
        const rows = await getOffersByRequest(supabase as any, request.id);
        setOffers(rows || []);
        const fids = Array.from(
          new Set((rows || []).map((o: any) => o.forwarder_id).filter(Boolean))
        );
        if (fids.length) {
          const { data: profs } = await (supabase as any)
            .from('profiles')
            .select('id,username,company_name,avatar_url')
            .in('id', fids);
          const map: any = {};
          for (const p of profs || []) map[p.id] = p;
          setActors(map);
        } else {
          setActors({});
        }
        // Negotiation counts per offer
        try {
          const offerIds = (rows || []).map((o: any) => o.id);
          if (offerIds.length) {
            const { data: negs, error: nerr } = await (supabase as any)
              .from('negotiations')
              .select('offer_id')
              .in('offer_id', offerIds as any);
            if (!nerr) {
              const byOffer: Record<string, number> = {};
              for (const n of (negs || []) as any[])
                byOffer[String(n.offer_id)] =
                  (byOffer[String(n.offer_id)] ?? 0) + 1;
              setNegotiationCounts(byOffer);
            } else {
              setNegotiationCounts({});
            }
          } else {
            setNegotiationCounts({});
          }
        } catch {
          setNegotiationCounts({});
        }
      } catch {
        setOffers([]);
        setNegotiationCounts({});
      }
      try {
        const mine = me
          ? await getOwnOfferForRequest(supabase as any, {
              requestId: request.id,
              forwarderId: me
            })
          : null;
        setMyOffer(mine || null);
      } catch {
        setMyOffer(null);
      }
    })();
  }, [request?.id, open]);

  // Load request owner profile for header hover preview
  useEffect(() => {
    if (!request) {
      setOwnerProfile(null);
      return;
    }
    // Prime from enriched request fields if present to avoid 'User' placeholder
    const fallback = {
      id: request.user_id,
      company_name: (request as any).owner_company_name ?? null,
      username: request.owner_username ?? null,
      avatar_url: request.owner_avatar_url ?? null
    } as any;
    if (fallback.company_name || fallback.username || fallback.avatar_url) {
      setOwnerProfile(fallback);
    }
    if (!request.user_id) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('id,username,company_name,email,avatar_url')
          .eq('id', request.user_id)
          .maybeSingle();
        if (!error && data) setOwnerProfile(data);
      } catch {}
    })();
  }, [request]);

  const ownerDisplay =
    ownerProfile?.company_name ||
    ownerProfile?.username ||
    ownerProfile?.email ||
    request?.owner_username ||
    'User';
  const ownerAvatar =
    ownerProfile?.avatar_url || request?.owner_avatar_url || undefined;
  const isOwner =
    role === 'shipper' || (me && request?.user_id && me === request.user_id);

  // Parse offers once and attach actor/company for filtering/sorting
  const parsedOffers = useMemo(() => {
    return (offers || []).map((o: any) => {
      const d =
        typeof o.details === 'string'
          ? (() => {
              try {
                return JSON.parse(o.details);
              } catch {
                return {};
              }
            })()
          : o.details || {};
      const actor = actors[o.forwarder_id] as any;
      const company = actor?.company_name || actor?.username || '';
      const total = Number(d.total_price ?? NaN);
      const transit = Number(d.transit_time ?? NaN);
      const currency = d.total_price_currency || d.currency || '';
      return {
        ...o,
        __details: d,
        __actor: actor,
        __company: company,
        __total: total,
        __transit: transit,
        __currency: currency
      };
    });
  }, [offers, actors]);

  // Build currencies set
  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const o of parsedOffers) {
      if (o.__currency) set.add(String(o.__currency));
    }
    return Array.from(set);
  }, [parsedOffers]);

  // Derived filtered/sorted offers for owners
  const derivedOffers = useMemo(() => {
    let list = parsedOffers;
    if (ownerQuery.trim()) {
      const q = ownerQuery.trim().toLowerCase();
      list = list.filter((o) => (o.__company || '').toLowerCase().includes(q));
    }
    if (statusFilter) {
      list = list.filter(
        (o) => (o.status || '').toLowerCase() === statusFilter.toLowerCase()
      );
    }
    if (currencyFilter) {
      list = list.filter((o) => String(o.__currency) === currencyFilter);
    }
    const sort = ownerSort;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return (a.__total || Infinity) - (b.__total || Infinity);
        case 'price_desc':
          return (b.__total || -Infinity) - (a.__total || -Infinity);
        case 'transit_asc':
          return (a.__transit || Infinity) - (b.__transit || Infinity);
        case 'transit_desc':
          return (b.__transit || -Infinity) - (a.__transit || -Infinity);
        case 'company_asc':
          return (a.__company || '').localeCompare(b.__company || '');
        case 'company_desc':
          return (b.__company || '').localeCompare(a.__company || '');
        case 'created_asc':
          return (
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
          );
        case 'created_desc':
        default:
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
      }
    });
    return list;
  }, [parsedOffers, ownerQuery, statusFilter, currencyFilter, ownerSort]);

  function exportOffersCSV() {
    // Export all offers for this request, not just filtered
    const rows = parsedOffers;
    const headers = [
      'offer_id',
      'request_id',
      'forwarder_id',
      'forwarder_company',
      'forwarder_username',
      'status',
      'total_price',
      'currency',
      'transit_time',
      'service_scope',
      'payment_terms',
      'offer_validity',
      'created_at'
    ];
    const lines = [headers.join(',')];
    for (const o of rows) {
      const d = o.__details || {};
      const serviceScope = Array.isArray(d.service_scope)
        ? d.service_scope.join('|')
        : (d.service_scope ?? '');
      const vals = [
        o.id,
        o.request_id,
        o.forwarder_id,
        o.__company ?? '',
        o.__actor?.username ?? '',
        o.status ?? '',
        d.total_price ?? '',
        o.__currency ?? '',
        d.transit_time ?? '',
        serviceScope,
        d.payment_terms ?? '',
        d.offer_validity ?? '',
        o.created_at ?? ''
      ].map((v) => {
        const s = String(v ?? '');
        // escape quotes and wrap
        const escaped = '"' + s.replace(/"/g, '""') + '"';
        return escaped;
      });
      lines.push(vals.join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-${request?.code || request?.id}-offers.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF() {
    if (!exportRef.current) return;
    // Dynamic import to avoid SSR issues
    const [html2canvas, jsPDFModule] = await Promise.all([
      import('html2canvas').then((m) => m.default || m),
      import('jspdf').then((m) => m.jsPDF || (m as any).default || (m as any))
    ]);

    // Create an offscreen container to reliably render the receipt
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '820px',
      background: '#ffffff',
      padding: '0',
      margin: '0',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '2147483647'
    });
    document.body.appendChild(container);
    const source = exportRef.current.querySelector(
      '.nv-receipt'
    ) as HTMLElement | null;
    const clone = (
      source ? source.cloneNode(true) : exportRef.current.cloneNode(true)
    ) as HTMLElement;
    (clone as HTMLElement).style.display = 'block';
    container.appendChild(clone);

    // Ensure fonts and images in the clone are loaded
    const imgs = Array.from(
      container.querySelectorAll('img')
    ) as HTMLImageElement[];
    const fontReady = (document as any).fonts?.ready
      ? (document as any).fonts.ready.catch(() => {})
      : Promise.resolve();
    await Promise.all(
      imgs
        .map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((res, rej) => {
                img.onload = () => res();
                img.onerror = () => res();
              })
        )
        .concat([fontReady as Promise<any>])
    );

    let canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      useCORS: true,
      scale: 2,
      foreignObjectRendering: false,
      windowWidth: Math.max(clone.scrollWidth, 820),
      windowHeight: Math.max(clone.scrollHeight, 1123),
      onclone: (doc) => {
        // Ensure plain colors in the cloned tree to avoid lab()/oklch parsing in some browsers
        const style = doc.createElement('style');
        style.innerHTML = `
          .nv-receipt, .nv-receipt * { 
            color: inherit !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          html, body { background: #ffffff !important; }
          :root, .nv-receipt {
            /* Force hex/rgb variables to avoid oklch/lab */
            --background: #ffffff; --foreground: #111111; --card: #ffffff; --card-foreground: #111111;
            --popover: #ffffff; --popover-foreground: #111111; --primary: #111111; --primary-foreground: #ffffff;
            --secondary: #f3f4f6; --secondary-foreground: #111111; --muted: #f3f4f6; --muted-foreground: #6b7280;
            --accent: #f3f4f6; --accent-foreground: #111111; --destructive: #ef4444; --border: #e5e7eb;
            --input: #e5e7eb; --ring: #94a3b8; --chart-1: #3b82f6; --chart-2: #10b981; --chart-3: #f59e0b;
            --chart-4: #8b5cf6; --chart-5: #ec4899; --sidebar: #ffffff; --sidebar-foreground: #111111;
            --sidebar-primary: #111111; --sidebar-primary-foreground: #ffffff; --sidebar-accent: #f3f4f6;
            --sidebar-accent-foreground: #111111; --sidebar-border: #e5e7eb; --sidebar-ring: #94a3b8;
            color-scheme: light !important;
          }
        `;
        doc.head.appendChild(style);
      },
      removeContainer: true
    });

    // Helper: detect if canvas is blank (mostly white)
    const isCanvasBlank = (c: HTMLCanvasElement) => {
      try {
        const ctx = c.getContext('2d');
        if (!ctx) return false;
        const step = Math.max(1, Math.floor(Math.min(c.width, c.height) / 50));
        for (let y = 0; y < c.height; y += step) {
          for (let x = 0; x < c.width; x += step) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            // any non-white pixel indicates content
            if (!(d[0] === 255 && d[1] === 255 && d[2] === 255 && d[3] !== 0)) {
              return false;
            }
          }
        }
        return true;
      } catch {
        return false;
      }
    };

    // Fallback: if canvas is zero or appears blank, try dom-to-image-more
    if (!canvas || !canvas.width || !canvas.height || isCanvasBlank(canvas)) {
      try {
        const domToImage = await import('dom-to-image-more').then(
          (m: any) => m?.default ?? m
        );
        const dataUrl = await domToImage.toPng(clone as Node, {
          bgcolor: '#ffffff',
          quality: 1,
          cacheBust: true,
          style: { background: '#ffffff' }
        });
        // Create a temporary image to get dimensions
        const tmp = new Image();
        await new Promise<void>((resolve) => {
          tmp.onload = () => resolve();
          tmp.onerror = () => resolve();
          tmp.src = dataUrl as string;
        });
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = tmp.naturalWidth || 794;
        tmpCanvas.height = tmp.naturalHeight || 1123;
        const ctx = tmpCanvas.getContext('2d');
        if (ctx) ctx.drawImage(tmp, 0, 0);
        canvas = tmpCanvas;
      } catch (e) {
        // proceed with whatever we have (will likely produce an empty pdf, but avoids crash)
      }
    }
    const imgData = canvas.toDataURL('image/png');

    // Create PDF sized to image aspect ratio on A4 width
    const pdf = new jsPDFModule('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Convert px canvas to mm keeping aspect ratio
    const imgProps = { width: canvas.width, height: canvas.height };
    const ratio = imgProps.width / imgProps.height;
    const pdfWidth = pageWidth;
    const pdfHeight = pdfWidth / ratio;

    let y = 0;
    if (pdfHeight <= pageHeight) {
      pdf.addImage(
        imgData,
        'PNG',
        0,
        y,
        pdfWidth,
        pdfHeight,
        undefined,
        'FAST'
      );
    } else {
      // Multi-page if content taller than one page
      let remainingHeight = pdfHeight;
      let position = 0;
      const pageCanvasHeight = (pageHeight / pdfHeight) * canvas.height; // in px equivalent per page
      const pageCount = Math.ceil(pdfHeight / pageHeight);
      for (let i = 0; i < pageCount; i++) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(
          pageCanvasHeight,
          canvas.height - position
        );
        const pageCtx = pageCanvas.getContext('2d')!;
        pageCtx.drawImage(
          canvas,
          0,
          position,
          canvas.width,
          pageCanvas.height,
          0,
          0,
          canvas.width,
          pageCanvas.height
        );
        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgHeight = Math.min(pageHeight, remainingHeight);
        pdf.addImage(
          pageImgData,
          'PNG',
          0,
          0,
          pdfWidth,
          pageImgHeight,
          undefined,
          'FAST'
        );
        remainingHeight -= pageHeight;
        position += pageCanvasHeight;
        if (i < pageCount - 1) pdf.addPage();
      }
    }

    const fileName = `request-${request?.code || request?.id || 'export'}.pdf`;
    // Use Blob to force a direct download without opening a preview tab
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    // Clean up container
    container.remove();
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <div className='flex items-center gap-2'>
          <button
            type='button'
            className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800'
            aria-label='Expand'
            onClick={() => {
              /* TODO: expand panel */
            }}
          >
            <Maximize2 className='h-4 w-4' />
          </button>
          <button
            type='button'
            className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800'
            aria-label='Share'
            onClick={async () => {
              try {
                const url =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}${window.location.pathname}?request=${encodeURIComponent(request?.id || '')}`
                    : '';
                if ((navigator as any).share) {
                  await (navigator as any).share({
                    title: `Request ${request?.code}`,
                    url
                  });
                } else if (navigator.clipboard && url) {
                  await navigator.clipboard.writeText(url);
                }
              } catch {}
            }}
          >
            <Share2 className='h-4 w-4' />
          </button>
          {/* Separator */}
          <span className='mx-1 h-6 w-px bg-neutral-200 dark:bg-neutral-800' />
          {/* Owner avatar with hover preview */}
          <HoverCard openDelay={80} closeDelay={60}>
            <HoverCardTrigger asChild>
              <button
                type='button'
                className='flex cursor-pointer items-center focus:outline-none'
              >
                <Avatar className='h-8 w-8'>
                  <AvatarImage src={ownerAvatar} alt={ownerDisplay} />
                  <AvatarFallback>
                    {(ownerDisplay || 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align='start'
              sideOffset={8}
              side='bottom'
              className='w-72'
            >
              <div className='flex items-center gap-3'>
                <Avatar className='h-10 w-10'>
                  <AvatarImage src={ownerAvatar} alt={ownerDisplay} />
                  <AvatarFallback>
                    {(ownerDisplay || 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-semibold'>
                    {ownerDisplay}
                  </div>
                  {(ownerProfile?.username || request?.owner_username) && (
                    <div className='text-muted-foreground truncate text-xs'>
                      @{ownerProfile?.username || request?.owner_username}
                    </div>
                  )}
                </div>
              </div>
              <div className='text-muted-foreground mt-3 text-xs'>
                Request owner
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      }
    >
      <div className='flex flex-col gap-4'>
        {showEmbeddedOffer ? (
          <ForwarderOfferForm
            embedded
            useExternalFooter
            ref={offerFormRef}
            onCancel={() => setShowEmbeddedOffer(false)}
            requestId={request?.id}
            forwarderId={me}
            requestDetails={details}
            ownerId={request?.user_id}
            existingOffer={
              myOffer ? { id: myOffer.id, details: myOffer.details } : null
            }
            onStateChange={(s) => setFormState(s)}
            onSubmitted={() => {
              setShowEmbeddedOffer(false);
              (async () => {
                try {
                  const rows = await getOffersByRequest(
                    supabase as any,
                    request.id
                  );
                  setOffers(rows || []);
                } catch {}
                try {
                  const mine = me
                    ? await getOwnOfferForRequest(supabase as any, {
                        requestId: request.id,
                        forwarderId: me
                      })
                    : null;
                  setMyOffer(mine || null);
                } catch {}
              })();
            }}
          />
        ) : (
          <>
            {/* Summary content below header */}
            <div className='mb-2 flex flex-col gap-2'>
              <div className='flex flex-col gap-1'>
                {freightTypeLabel && (
                  <Badge
                    variant='outline'
                    className='flex w-fit items-center gap-1 text-xs'
                  >
                    {freightTypeIcon}
                    {freightTypeLabel}
                  </Badge>
                )}
                <span className='text-primary text-3xl font-extrabold tracking-tight'>
                  {request?.code}
                </span>
              </div>
              {cargoSection && (
                <div className='mb-1 flex flex-col gap-1'>
                  {cargoSection.fields
                    .filter(
                      (f: any) =>
                        details[f.id] !== undefined && details[f.id] !== ''
                    )
                    .map((f: any) => (
                      <div
                        key={f.id}
                        className='bg-muted/60 flex items-center gap-2 rounded px-2 py-1 text-sm'
                      >
                        {iconMap[f.id] || (
                          <Package className='text-muted-foreground h-4 w-4' />
                        )}
                        <span className='text-muted-foreground font-medium'>
                          {f.label}:
                        </span>
                        <span className='text-foreground font-mono'>
                          {String(details[f.id])}
                        </span>
                      </div>
                    ))}
                </div>
              )}
              {notesFields.length > 0 && (
                <div className='mb-1 flex flex-col gap-1'>
                  {notesFields.map((f: any) => (
                    <div
                      key={f.id}
                      className='bg-muted/40 flex items-center gap-2 rounded px-2 py-1 text-sm'
                    >
                      {iconMap[f.id] || (
                        <Package className='text-muted-foreground h-4 w-4' />
                      )}
                      <span className='text-muted-foreground font-medium'>
                        {f.label}:
                      </span>
                      <span className='text-foreground font-mono'>
                        {String(details[f.id])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {request?.status && (
                <div className='mb-2 flex items-center gap-2'>
                  <span className='text-muted-foreground text-xs font-medium'>
                    Status:
                  </span>
                  <Badge variant='secondary' className='w-fit capitalize'>
                    {request.status}
                  </Badge>
                </div>
              )}
            </div>
            <Tabs value={tab} onValueChange={setTab} className='w-full'>
              <TabsList className='scrollbar-thin scrollbar-thumb-muted/40 scrollbar-track-transparent bg-muted/60 mb-2 flex flex-nowrap gap-2 overflow-x-auto rounded-lg p-1'>
                {tabs.map((t, i) => (
                  <TabsTrigger
                    key={t}
                    value={String(i)}
                    className='relative max-w-full min-w-[140px] rounded-md px-5 py-2 text-center text-sm font-medium whitespace-nowrap'
                  >
                    {t.replace(/\s*Form$/i, '')}
                    {/* Only Offers tab gets badge */}
                    {i === tabs.length - 1 && tabCounts[i] > 0 && (
                      <span
                        className={`bg-primary text-primary-foreground ml-2 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold`}
                      >
                        {tabCounts[i]}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Section fields, but skip summary fields */}
              {tabSections.map((section: any, i: number) => (
                <TabsContent key={section.title} value={String(i)}>
                  <div className='bg-background/80 flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
                    <div className='mb-2 flex items-center gap-2 text-base font-semibold'>
                      {section.title}
                    </div>
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      {section.fields
                        .filter(
                          (f: any) =>
                            !summaryFieldIds.includes(f.id) &&
                            details[f.id] !== undefined &&
                            details[f.id] !== ''
                        )
                        .map((f: any) => (
                          <div
                            key={f.id}
                            className='bg-muted/40 flex flex-col gap-1 rounded p-2'
                          >
                            <div className='flex items-center gap-2'>
                              {iconMap[f.id] || (
                                <Package className='text-muted-foreground h-4 w-4' />
                              )}
                              <span className='text-muted-foreground text-xs font-medium'>
                                {f.label}
                              </span>
                            </div>
                            <span className='text-foreground font-mono text-sm break-all'>
                              {String(details[f.id])}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
              {/* Offers tab */}
              <TabsContent value={String(tabs.length - 1)}>
                <div className='bg-background/80 flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
                  <div className='mb-2 flex items-center gap-2 text-base font-semibold'>
                    Offers
                  </div>
                  {/* Owner-only controls: search bar + filter popover + CSV */}
                  {(role === 'shipper' ||
                    (me && request?.user_id && me === request.user_id)) &&
                    offers.length > 0 && (
                      <div className='flex flex-nowrap items-center gap-2'>
                        <Input
                          placeholder='Search forwarder...'
                          value={ownerQuery}
                          onChange={(e) => setOwnerQuery(e.target.value)}
                          className='min-w-0 flex-1'
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant='outline'
                              size='icon'
                              aria-label='Filters'
                            >
                              <Filter className='h-4 w-4' />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align='start'
                            sideOffset={8}
                            className='w-80'
                          >
                            <div className='flex flex-col gap-3'>
                              <div>
                                <div className='mb-1 text-xs font-semibold'>
                                  Sort
                                </div>
                                <Select
                                  value={ownerSort}
                                  onValueChange={(v: any) => setOwnerSort(v)}
                                >
                                  <SelectTrigger className='w-full justify-start'>
                                    <ArrowUpDown className='mr-2 h-4 w-4 opacity-70' />
                                    <SelectValue placeholder='Sort by' />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value='created_desc'>
                                      Newest
                                    </SelectItem>
                                    <SelectItem value='created_asc'>
                                      Oldest
                                    </SelectItem>
                                    <SelectItem value='price_asc'>
                                      Price: Low to High
                                    </SelectItem>
                                    <SelectItem value='price_desc'>
                                      Price: High to Low
                                    </SelectItem>
                                    <SelectItem value='transit_asc'>
                                      Transit: Fastest
                                    </SelectItem>
                                    <SelectItem value='transit_desc'>
                                      Transit: Slowest
                                    </SelectItem>
                                    <SelectItem value='company_asc'>
                                      Company A-Z
                                    </SelectItem>
                                    <SelectItem value='company_desc'>
                                      Company Z-A
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className='mb-1 text-xs font-semibold'>
                                  Status
                                </div>
                                <Select
                                  value={statusFilter || 'all'}
                                  onValueChange={(v) =>
                                    setStatusFilter(v === 'all' ? '' : v)
                                  }
                                >
                                  <SelectTrigger className='w-full justify-start'>
                                    <Badge className='mr-2 h-5 px-1.5 py-0 text-[10px]'>
                                      S
                                    </Badge>
                                    <SelectValue placeholder='Status' />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value='all'>
                                      All Statuses
                                    </SelectItem>
                                    <SelectItem value='sent'>Sent</SelectItem>
                                    <SelectItem value='accepted'>
                                      Accepted
                                    </SelectItem>
                                    <SelectItem value='declined'>
                                      Declined
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className='mb-1 text-xs font-semibold'>
                                  Currency
                                </div>
                                <Select
                                  value={currencyFilter || 'all'}
                                  onValueChange={(v) =>
                                    setCurrencyFilter(v === 'all' ? '' : v)
                                  }
                                >
                                  <SelectTrigger className='w-full justify-start'>
                                    <DollarSign className='mr-2 h-4 w-4 opacity-70' />
                                    <SelectValue placeholder='Currency' />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value='all'>All</SelectItem>
                                    {currencies.map((ccy) => (
                                      <SelectItem key={ccy} value={ccy}>
                                        {ccy}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={exportOffersCSV}
                        >
                          Export Offers CSV
                        </Button>
                      </div>
                    )}
                  {role === 'forwarder' && myOffer && !showEmbeddedOffer && (
                    <div className='bg-muted/30 flex items-center justify-between rounded-md border p-3'>
                      <div className='text-sm opacity-80'>
                        You’ve already sent an offer for this request.
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='secondary'
                          onClick={() => setShowEmbeddedOffer(true)}
                        >
                          Preview / Edit
                        </Button>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={async () => {
                            try {
                              await deleteOffer(supabase as any, {
                                offerId: myOffer.id
                              });
                              setMyOffer(null);
                              const rows = await getOffersByRequest(
                                supabase as any,
                                request.id
                              );
                              setOffers(rows || []);
                            } catch {}
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                  {offers.length === 0 ? (
                    <div className='text-muted-foreground text-xs'>
                      No offers yet.
                    </div>
                  ) : (
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      {derivedOffers.map((o) => {
                        const d = o.__details;
                        const total = d.total_price;
                        const ccy = o.__currency;
                        const t = Number(d.transit_time);
                        const transit = Number.isFinite(t)
                          ? `${t} ${t === 1 ? 'day' : 'days'}`
                          : '-';
                        const scope = Array.isArray(d.service_scope)
                          ? d.service_scope.join(', ')
                          : d.service_scope || '-';
                        const actor = o.__actor as any;
                        const hasNegotiation =
                          (negotiationCounts[String(o.id)] || 0) > 0;
                        return (
                          <div
                            key={o.id}
                            className={`bg-card rounded-lg border p-3 ${isOwner ? 'hover:bg-muted/30 cursor-pointer transition-colors' : ''}`}
                            onClick={() => {
                              if (!isOwner) return;
                              setSelectedOffer(o);
                              setDetailsOpen(true);
                            }}
                            role={isOwner ? 'button' : undefined}
                            aria-label={
                              isOwner ? 'View offer details' : undefined
                            }
                          >
                            <div className='grid grid-cols-[1fr_auto] items-center gap-3'>
                              {/* Left: budget (price) and info */}
                              <div className='min-w-0'>
                                <div className='flex items-center gap-2 text-base font-semibold'>
                                  <span>{total ? `${total} ${ccy}` : '—'}</span>
                                  {hasNegotiation && (
                                    <Badge className='border-amber-200 bg-amber-50 px-1 py-0 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300'>
                                      Negotiation
                                    </Badge>
                                  )}
                                </div>
                                <div className='text-[11px] opacity-80'>
                                  Transit: {transit}
                                </div>
                                <div className='truncate text-[11px] opacity-80'>
                                  {scope}
                                </div>
                              </div>
                              {/* Right: centered avatar + username */}
                              <div className='flex w-24 flex-col items-center justify-center'>
                                <img
                                  src={actor?.avatar_url || '/logomark.svg'}
                                  alt=''
                                  className='h-8 w-8 rounded-full border'
                                />
                                <div className='text-foreground/80 mt-1 max-w-[88px] truncate text-center text-[11px]'>
                                  {actor?.company_name ||
                                    actor?.username ||
                                    'Forwarder'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(role === 'shipper' || role === 'other' || !role) &&
                    offers.length > 1 && (
                      <div className='flex justify-end'>
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => setCompareOpen(true)}
                        >
                          Compare Offers
                        </Button>
                      </div>
                    )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Hidden export layout (receipt-like) using inline hex colors to avoid lab()/oklch parsing */}
        <div ref={exportRef} style={{ display: 'none' }}>
          <div
            data-theme='light'
            className='nv-receipt'
            style={{
              width: 794,
              margin: '0 auto',
              background: '#ffffff',
              color: '#000000',
              padding: 24,
              border: '1px solid #e5e5e5',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              isolation: 'isolate'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#666666' }}>
                NOBLEVERSE FREIGHT
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                REQUEST SUMMARY
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: '#666666' }}>
                Planet Earth ·{' '}
                {new Date(
                  request?.created_at || Date.now()
                ).toLocaleDateString()}
              </div>
            </div>
            <div
              style={{ margin: '12px 0', borderTop: '1px dashed #cccccc' }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#777777' }}>Code</span>
                <span style={{ fontWeight: 600 }}>{request?.code || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#777777' }}>Freight Type</span>
                <span style={{ fontWeight: 600 }}>
                  {freightTypeLabel || '-'}
                </span>
              </div>
              {request?.status && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ color: '#777777' }}>Status</span>
                  <span
                    style={{ fontWeight: 600, textTransform: 'capitalize' }}
                  >
                    {request.status}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{ margin: '12px 0', borderTop: '1px dashed #cccccc' }}
            />

            {/* Fields list */}
            <div>
              {availableSections.map((section: any) => (
                <div key={section.title}>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: 0.5,
                      color: '#5e5e5e',
                      marginBottom: 4
                    }}
                  >
                    {section.title}
                  </div>
                  {section.fields
                    .filter(
                      (f: any) =>
                        details[f.id] !== undefined && details[f.id] !== ''
                    )
                    .map((f: any) => (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12
                        }}
                      >
                        <span style={{ color: '#777777' }}>{f.label}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            maxWidth: '55%',
                            textAlign: 'right',
                            wordBreak: 'break-word'
                          }}
                        >
                          {String(details[f.id])}
                        </span>
                      </div>
                    ))}
                  <div
                    style={{ marginTop: 8, borderBottom: '1px dashed #e0e0e0' }}
                  />
                </div>
              ))}
            </div>

            {/* Offers summary in export */}
            {offers && offers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  OFFERS
                </div>
                <div
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 6,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      gap: 0,
                      background: '#f8f8f8',
                      color: '#222',
                      fontWeight: 700,
                      fontSize: 11
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e5e5e5'
                      }}
                    >
                      Company
                    </div>
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e5e5e5'
                      }}
                    >
                      Status
                    </div>
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRight: '1px solid #e5e5e5'
                      }}
                    >
                      Total
                    </div>
                    <div style={{ padding: '6px 8px' }}>Transit</div>
                  </div>
                  {(offers as any[]).map((o, idx) => {
                    const d =
                      typeof o.details === 'string'
                        ? (() => {
                            try {
                              return JSON.parse(o.details);
                            } catch {
                              return {};
                            }
                          })()
                        : o.details || {};
                    const actor = (actors as any)[o.forwarder_id] as any;
                    const company =
                      actor?.company_name || actor?.username || 'Forwarder';
                    const total =
                      d.total_price != null
                        ? `${d.total_price} ${d.total_price_currency || d.currency || ''}`
                        : '—';
                    const transit =
                      d.transit_time != null ? `${d.transit_time} d` : '—';
                    return (
                      <div
                        key={o.id || idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          gap: 0,
                          borderTop: '1px solid #e5e5e5',
                          fontSize: 11
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRight: '1px solid #e5e5e5'
                          }}
                        >
                          {company}
                        </div>
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRight: '1px solid #e5e5e5',
                            textTransform: 'capitalize'
                          }}
                        >
                          {o.status || '—'}
                        </div>
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRight: '1px solid #e5e5e5'
                          }}
                        >
                          {total}
                        </div>
                        <div style={{ padding: '6px 8px' }}>{transit}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, height: 1, background: '#d4d4d4' }} />
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#555555'
              }}
            >
              <img
                src='/logomark.svg'
                alt='NobleVerse'
                width={18}
                height={18}
              />
              <span>NobleVerse®</span>
            </div>
          </div>
        </div>
      </div>
      {request?.id && (
        <ForwarderOfferForm
          open={offerOpen}
          onClose={() => setOfferOpen(false)}
          requestId={request.id}
          forwarderId={me}
          onSubmitted={() => {
            // refresh offers
            (async () => {
              try {
                const rows = await getOffersByRequest(
                  supabase as any,
                  request.id
                );
                setOffers(rows || []);
              } catch {}
            })();
          }}
        />
      )}
      {compareOpen && offers.length > 1 && (
        <CompareOffersPanel
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          offers={offers as any}
          isOwner={isOwner}
          onAccepted={async () => {
            try {
              const rows = await getOffersByRequest(
                supabase as any,
                request.id
              );
              setOffers(rows || []);
            } catch {}
          }}
        />
      )}
      {/* Owner offer details dialog */}
      {detailsOpen && selectedOffer && (
        <OfferDetailsDialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          offer={selectedOffer}
          actor={actors[(selectedOffer as any).forwarder_id] as any}
          isOwner={isOwner}
          onAccepted={async () => {
            try {
              const rows = await getOffersByRequest(
                supabase as any,
                request.id
              );
              setOffers(rows || []);
            } catch {}
          }}
        />
      )}
      {/* Footer portal: export + offer flow actions */}
      {typeof document !== 'undefined' &&
        document.getElementById('sidepanel-footer-slot') &&
        createPortal(
          <div className='w-full border-t border-neutral-200 bg-white/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-900/95'>
            <div className='mx-4 flex items-center justify-between gap-2'>
              {!showEmbeddedOffer ? (
                <div className='ml-auto flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleExportPDF}
                    className='font-semibold'
                  >
                    Export Request
                  </Button>
                  {role === 'forwarder' &&
                    (!myOffer ? (
                      <Button
                        size='sm'
                        onClick={() => setShowEmbeddedOffer(true)}
                        className='bg-orange-500 font-bold text-white hover:bg-orange-600'
                      >
                        Make an Offer
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() => setShowEmbeddedOffer(true)}
                      >
                        Preview Offer
                      </Button>
                    ))}
                </div>
              ) : (
                <div className='ml-auto flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      if (formState.isFirst) {
                        setShowEmbeddedOffer(false);
                      } else {
                        offerFormRef.current?.back();
                      }
                    }}
                  >
                    {formState.isFirst ? 'Cancel' : 'Back'}
                  </Button>
                  {!formState.isLast ? (
                    <Button
                      size='sm'
                      disabled={!formState.currentValid}
                      onClick={() => offerFormRef.current?.next()}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      size='sm'
                      onClick={() => offerFormRef.current?.submit()}
                      disabled={formState.submitting || !formState.currentValid}
                      className='bg-orange-500 font-bold text-white hover:bg-orange-600'
                    >
                      {formState.submitting
                        ? myOffer
                          ? 'Saving...'
                          : 'Submitting...'
                        : myOffer
                          ? 'Save Changes'
                          : 'Submit Offer'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.getElementById('sidepanel-footer-slot') as HTMLElement
        )}
    </SidePanel>
  );
};
