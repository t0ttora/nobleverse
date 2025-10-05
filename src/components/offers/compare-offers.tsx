'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// Removed inline OfferDetailsDialog usage to avoid double-modal stacking.
// (ToggleGroup removed; custom buttons used instead of toggle group)
// import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  Table as TableIcon,
  Loader2,
  FileDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type OfferLike = { id: string; status?: string; details: any };

const FIELDS: { key: string; label: string }[] = [
  { key: 'total_price', label: 'Total Price' },
  { key: 'total_price_currency', label: 'Currency' },
  { key: 'currency', label: 'Currency (alt)' },
  { key: 'transit_time', label: 'Transit Time (days)' },
  { key: 'transit_time_guarantee', label: 'Transit Time Guaranteed' },
  { key: 'price_includes', label: 'Price Includes' },
  { key: 'service_scope', label: 'Scope of Service' },
  { key: 'payment_terms', label: 'Payment Terms' },
  { key: 'offer_validity', label: 'Offer Validity (days)' },
  { key: 'taxes_duties', label: 'Taxes/Duties Included' },
  { key: 'tracking_available', label: 'Tracking Available' },
  { key: 'carrier_info', label: 'Carrier / Line' },
  { key: 'free_time', label: 'Free Time (days)' },
  { key: 'value_added_services', label: 'Value-Added Services' },
  { key: 'company_name', label: 'Company' },
  { key: 'contact_person', label: 'Contact' }
];

function readDetails(d: any) {
  const obj =
    typeof d === 'string'
      ? (() => {
          try {
            return JSON.parse(d);
          } catch {
            return {};
          }
        })()
      : d || {};
  return obj as Record<string, any>;
}

export function CompareOffersPanel({
  open,
  onClose,
  offers,
  isOwner,
  onAccepted,
  order
}: {
  open: boolean;
  onClose: () => void;
  offers: OfferLike[];
  isOwner?: boolean;
  onAccepted?: (o: any) => void;
  order?: string[];
}) {
  const parsed = React.useMemo(
    () => offers.map((o) => ({ ...o, details: readDetails(o.details) })),
    [offers]
  );
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const tableWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = React.useState<'table' | 'compact'>('table');
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<OfferLike | null>(null);
  const [colWidth, setColWidth] = React.useState<number | null>(null);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [showAllSecondary, setShowAllSecondary] = React.useState(false);
  const [hoveredField, setHoveredField] = React.useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = React.useState<string | null>(
    null
  );
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const liveRef = React.useRef<HTMLDivElement | null>(null);
  const lastTriggerButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [localOrder, setLocalOrder] = React.useState<string[]>([]);
  const compactWrapperRef = React.useRef<HTMLDivElement | null>(null);
  // derive local order from incoming order prop or parsed sequence
  React.useEffect(() => {
    const ids = parsed.map((p) => String(p.id));
    if (order && order.length) {
      const filtered = order.filter((id) => ids.includes(id));
      if (filtered.length === ids.length) setLocalOrder(filtered);
      else setLocalOrder(ids);
    } else {
      setLocalOrder(ids);
    }
  }, [order, parsed]);

  // Reordering currently unused; can be re-enabled later if needed

  async function exportComparisonPDF() {
    try {
      if (typeof document !== 'undefined') {
        document.body.dataset.exporting = 'true';
      }
      const [html2canvas, jsPDFModule] = await Promise.all([
        import('html2canvas').then((m) => m.default || m),
        import('jspdf').then(
          (m) => (m as any).jsPDF || (m as any).default || (m as any)
        )
      ]);
      const target =
        viewMode === 'table'
          ? tableWrapperRef.current
          : compactWrapperRef.current;
      if (!target) throw new Error('Export target not found');
      const parentScrollable =
        viewMode === 'table' ? target.parentElement : target;
      const originalStyles: {
        el: HTMLElement;
        props: Record<string, string>;
      }[] = [];
      if (parentScrollable) {
        originalStyles.push({
          el: parentScrollable as HTMLElement,
          props: {
            maxHeight: (parentScrollable as HTMLElement).style.maxHeight || '',
            height: (parentScrollable as HTMLElement).style.height || ''
          }
        });
        (parentScrollable as HTMLElement).style.maxHeight = 'none';
        (parentScrollable as HTMLElement).style.height = 'auto';
      }
      originalStyles.push({
        el: target,
        props: { overflow: (target as HTMLElement).style.overflow || '' }
      });
      (target as HTMLElement).style.overflow = 'visible';
      await new Promise((r) => requestAnimationFrame(r));
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        windowWidth: Math.max(target.scrollWidth, target.clientWidth),
        windowHeight: Math.max(target.scrollHeight, target.clientHeight)
      });
      for (const s of originalStyles) Object.assign(s.el.style, s.props);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFModule('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const targetWidth = pageWidth;
      const targetHeight = targetWidth / ratio;
      if (targetHeight <= pageHeight) {
        pdf.addImage(
          imgData,
          'PNG',
          0,
          0,
          targetWidth,
          targetHeight,
          undefined,
          'FAST'
        );
      } else {
        const fullHeightMM = targetHeight;
        const pages = Math.ceil(fullHeightMM / pageHeight);
        for (let i = 0; i < pages; i++) {
          if (i > 0) pdf.addPage();
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          const sliceHeightPx = Math.min(
            canvas.height - Math.floor((i * canvas.height) / pages),
            Math.floor(canvas.height / pages)
          );
          sliceCanvas.height = sliceHeightPx;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              canvas,
              0,
              Math.floor((i * canvas.height) / pages),
              canvas.width,
              sliceHeightPx,
              0,
              0,
              canvas.width,
              sliceHeightPx
            );
          }
          const sliceData = sliceCanvas.toDataURL('image/png');
          const sliceHeightMM = (sliceHeightPx / canvas.height) * fullHeightMM;
          pdf.addImage(
            sliceData,
            'PNG',
            0,
            0,
            targetWidth,
            sliceHeightMM,
            undefined,
            'FAST'
          );
        }
      }
      pdf.save(`comparison-${new Date().toISOString().slice(0, 10)}.pdf`, {
        returnPromise: false
      });
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    } finally {
      if (typeof document !== 'undefined')
        delete (document.body.dataset as any).exporting;
    }
  }

  function AcceptAction({ sel }: { sel: OfferLike }) {
    const [confirming, setConfirming] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const start = () => {
      setError(null);
      setConfirming(true);
    };
    const cancel = () => {
      if (!loading) {
        setConfirming(false);
        setError(null);
      }
    };
    const doAccept = async () => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const maybe = onAccepted?.(sel);
        if (maybe && typeof (maybe as any).then === 'function') await maybe;
        toast.success(`Offer ${sel.id} accepted`);
        if (liveRef.current)
          liveRef.current.textContent = `Offer ${sel.id} accepted`;
        setDetailsOpen(false);
        setSelected(null);
        if (lastTriggerButtonRef.current) lastTriggerButtonRef.current.focus();
      } catch (e: any) {
        const msg = e?.message || 'Accept failed';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    if (!isOwner) return null;
    if (!confirming)
      return (
        <Button
          size='sm'
          variant='outline'
          onClick={start}
          className='ml-2 h-6 px-2 text-[10px]'
        >
          Accept
        </Button>
      );
    return (
      <div className='ml-2 flex items-center gap-1 text-[10px]'>
        <span className='bg-muted rounded border px-2 py-0.5'>Emin misin?</span>
        <Button
          size='sm'
          variant='destructive'
          disabled={loading}
          onClick={doAccept}
          className='flex h-6 items-center gap-1 px-2 text-[10px]'
        >
          {loading && <Loader2 className='h-3 w-3 animate-spin' />}
          Evet
        </Button>
        <Button
          size='sm'
          variant='ghost'
          disabled={loading}
          onClick={cancel}
          className='h-6 px-2 text-[10px]'
        >
          İptal
        </Button>
        {error && <span className='text-destructive ml-1'>{error}</span>}
      </div>
    );
  }

  const fields = FIELDS;

  // Diff detection
  // Track diff keys (kept internally for inline/details highlighting) but do not show toggle.
  const diffKeys = React.useMemo(() => {
    const diffs = new Set<string>();
    for (const f of FIELDS) {
      const vals = new Set<string>();
      for (const o of parsed) {
        let raw: any = (o.details as any)[f.key];
        if (Array.isArray(raw)) raw = raw.join(',');
        if (raw === undefined || raw === null || raw === '') raw = '—';
        if (typeof raw === 'boolean') raw = raw ? 'Yes' : 'No';
        vals.add(String(raw));
        if (vals.size > 1) {
          diffs.add(f.key);
          break;
        }
      }
    }
    return diffs;
  }, [parsed]);
  const effectiveFields = fields; // always show all now

  // Load persisted view mode
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('nv.compare.viewMode');
    if (saved === 'table' || saved === 'compact') setViewMode(saved);
  }, []);

  // Persist view mode
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('nv.compare.viewMode', viewMode);
  }, [viewMode]);

  // Auto switch to compact for many columns or narrow viewport (soft preference, user can switch back)
  React.useEffect(() => {
    if (!open) return;
    const width = typeof window !== 'undefined' ? window.innerWidth : 0;
    if ((offers.length > 6 || width < 640) && viewMode === 'table')
      setViewMode('compact');
  }, [offers.length, open, viewMode]);

  // Listen to resize for responsive auto-compact (do not override if user already on compact)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (!open) return;
      if (window.innerWidth < 560 && viewMode === 'table') {
        setViewMode('compact');
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [open, viewMode]);

  // Layering logic + make overlay invisible & non-interactive (user request: remove background layer)
  // Also ensure toast (Sonner) layer stays above: we purposely set dialog below an explicit toast layer if present.
  React.useLayoutEffect(() => {
    const dialogEls = document.querySelectorAll('[data-slot=dialog-content]');
    const el = dialogEls[dialogEls.length - 1] as HTMLElement | null;
    if (el && el.parentElement === document.body) {
      document.body.appendChild(el);
    } else if (el) {
      let p: HTMLElement | null = el.parentElement;
      while (p && p.parentElement && p.parentElement !== document.body)
        p = p.parentElement;
      if (p && p.parentElement === document.body) document.body.appendChild(p);
    }
    const id = 'nv-compare-z-style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = `
        /* Raise dialog high but keep toast higher */
        .z-overlay-max{z-index:2147483600 !important;} 
        [data-sonner-toaster]{z-index:2147483646 !important; pointer-events:auto !important;}
      `;
      document.head.appendChild(style);
    }
    if (open && contentRef.current) {
      const content = contentRef.current;
      content.style.zIndex = '2147483600';
      content.style.pointerEvents = 'auto';
      const overlay = content.previousElementSibling as HTMLElement | null;
      if (overlay && overlay.dataset.slot === 'dialog-overlay') {
        overlay.style.background = 'transparent';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '2147483550';
      }
    }
  }, [open]);

  const colors = [
    'bg-blue-600 text-white',
    'bg-emerald-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white'
  ];

  const renderValue = (o: any, key: string) => {
    const raw = (o.details as any)[key];
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    if (raw === undefined || raw === null || raw === '') return '—';
    return String(raw);
  };
  // Inject once: custom truncation utility for compact card values (2 lines clamp)
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('nv-compare-compact-css')) {
      const style = document.createElement('style');
      style.id = 'nv-compare-compact-css';
      style.textContent = `
        .nv-multi-truncate{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Keyboard: ESC closes details (inline or side) without closing dialog, Shift+Tab cycles focus back to view buttons
  React.useEffect(() => {
    if (!detailsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDetailsOpen(false);
        setSelected(null);
      }
      if (e.key === 'Tab' && e.shiftKey) {
        const firstBtn = document.querySelector(
          '[data-compare-view-buttons] button'
        ) as HTMLButtonElement | null;
        if (firstBtn) {
          e.preventDefault();
          firstBtn.focus();
        }
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [detailsOpen]);

  const primaryFieldKeys = [
    'total_price',
    'total_price_currency',
    'currency',
    'transit_time',
    'transit_time_guarantee',
    'payment_terms',
    'offer_validity'
  ];
  const secondaryFieldKeys = fields
    .map((f) => f.key)
    .filter((k) => !primaryFieldKeys.includes(k));
  // Inline 'show more' state removed; details panel replaces inline expansion
  const suppressHighlights =
    typeof document !== 'undefined' &&
    document.body.dataset.exporting === 'true';

  // Detect mobile (small viewport) for inline details fallback
  React.useEffect(() => {
    const detect = () => setIsMobile(window.innerWidth < 640);
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, []);

  // Desktop side details panel (re-added)
  const detailsPanel =
    !isMobile && detailsOpen && selected ? (
      <div
        ref={panelRef}
        className={cn(
          'bg-background relative flex w-[380px] max-w-sm shrink-0 flex-col rounded-lg border px-4 pt-4 pb-3 shadow-sm',
          prevSelectedId && selected && prevSelectedId !== selected.id
            ? 'animate-in fade-in duration-300'
            : 'animate-in fade-in slide-in-from-right'
        )}
        aria-label={selected ? `Offer ${selected.id} details` : 'Offer details'}
        tabIndex={-1}
      >
        <div className='mb-3 flex items-start gap-3'>
          <div className='flex min-w-0 flex-col'>
            <div className='flex items-center gap-2'>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className='max-w-[200px] truncate text-sm font-semibold'
              >
                Offer #{selected?.id}
              </h3>
              {selected?.status && (
                <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium capitalize'>
                  {selected.status}
                </span>
              )}
            </div>
            <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
              Details
            </span>
          </div>
          <div className='ml-auto flex items-center gap-1'>
            <Button
              size='icon'
              variant='ghost'
              disabled={parsed.length < 2}
              onClick={() => {
                if (!selected) return;
                const idx = parsed.findIndex((p) => p.id === selected.id);
                const next = (idx - 1 + parsed.length) % parsed.length;
                setPrevSelectedId(selected.id);
                setSelected(parsed[next]);
              }}
              className='h-7 w-7'
            >
              <span className='sr-only'>Previous</span>
              <svg viewBox='0 0 20 20' className='h-4 w-4'>
                <path
                  fill='currentColor'
                  d='M12.7 15.3a1 1 0 0 1-1.4 0L6 10l5.3-5.3a1 1 0 1 1 1.4 1.4L8.42 10l4.3 4.3a1 1 0 0 1-.02 1z'
                />
              </svg>
            </Button>
            <Button
              size='icon'
              variant='ghost'
              disabled={parsed.length < 2}
              onClick={() => {
                if (!selected) return;
                const idx = parsed.findIndex((p) => p.id === selected.id);
                const next = (idx + 1) % parsed.length;
                setPrevSelectedId(selected.id);
                setSelected(parsed[next]);
              }}
              className='h-7 w-7'
            >
              <span className='sr-only'>Next</span>
              <svg viewBox='0 0 20 20' className='h-4 w-4'>
                <path
                  fill='currentColor'
                  d='M7.3 4.7a1 1 0 0 1 1.4 0L14 10l-5.3 5.3a1 1 0 0 1-1.4-1.4L11.58 10l-4.3-4.3a1 1 0 0 1 .02-1z'
                />
              </svg>
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setDetailsOpen(false);
                setSelected(null);
                if (lastTriggerButtonRef.current)
                  lastTriggerButtonRef.current.focus();
              }}
            >
              Close
            </Button>
          </div>
        </div>
        <div className='custom-scrollbar flex-1 overflow-y-auto pr-1'>
          <div className='mb-3 grid grid-cols-2 gap-2'>
            {primaryFieldKeys.map((k) => {
              const f = fields.find((f) => f.key === k);
              if (!f) return null;
              const val = selected ? renderValue(selected, k) : '—';
              const diff = diffKeys.has(k) && !suppressHighlights;
              return (
                <div
                  key={k}
                  onMouseEnter={() => setHoveredField(k)}
                  className={cn(
                    'group relative flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                    diff ? 'border-accent/60' : 'border-border/40',
                    hoveredField === k && 'border-accent shadow-sm'
                  )}
                >
                  {diff && (
                    <span className='bg-accent ring-background absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2' />
                  )}
                  <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                    {f.label}
                  </span>
                  <span className='font-medium break-words'>{val}</span>
                </div>
              );
            })}
          </div>
          <div className='mb-2'>
            <button
              type='button'
              onClick={() => setShowAllSecondary((v) => !v)}
              className='text-primary text-[10px] font-semibold tracking-wide uppercase hover:underline'
            >
              {showAllSecondary
                ? 'Hide Additional Fields'
                : 'Show Additional Fields'}
            </button>
            {selected && <AcceptAction sel={selected} />}
          </div>
          {showAllSecondary && selected && (
            <div className='mb-4 grid grid-cols-2 gap-2'>
              {secondaryFieldKeys.map((k) => {
                const f = fields.find((f) => f.key === k);
                if (!f) return null;
                const val = renderValue(selected, k);
                const diff = diffKeys.has(k) && !suppressHighlights;
                return (
                  <div
                    key={k}
                    onMouseEnter={() => setHoveredField(k)}
                    className={cn(
                      'group relative flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                      diff ? 'border-accent/50' : 'border-border/30',
                      hoveredField === k && 'border-accent shadow-sm'
                    )}
                  >
                    {diff && (
                      <span className='bg-accent ring-background absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2' />
                    )}
                    <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                      {f.label}
                    </span>
                    <span className='font-medium break-words'>{val}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className='mt-1 flex items-center justify-between border-t pt-2'>
          <span className='text-muted-foreground text-[10px]'>
            ESC · ← → switch
          </span>
          <div className='flex items-center gap-1'>
            {parsed.map((p, i) => {
              const active = selected && p.id === selected.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (!selected) return;
                    setPrevSelectedId(selected.id);
                    setSelected(p);
                  }}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    active
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'
                  )}
                  aria-label={`Offer ${i + 1}`}
                />
              );
            })}
          </div>
        </div>
        <div aria-live='polite' ref={liveRef} className='sr-only' />
      </div>
    ) : null;

  // Keyboard left/right for offer switching when panel open
  React.useEffect(() => {
    if (!detailsOpen || !selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        const idx = parsed.findIndex((p) => p.id === selected.id);
        if (idx === -1) return;
        const next = (idx - 1 + parsed.length) % parsed.length;
        setSelected(parsed[next]);
      } else if (e.key === 'ArrowRight') {
        const idx = parsed.findIndex((p) => p.id === selected.id);
        if (idx === -1) return;
        const next = (idx + 1) % parsed.length;
        setSelected(parsed[next]);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [detailsOpen, selected, parsed]);

  // Vertical separator between dialog and panel
  // Separator becomes an inline element now
  const showSeparator = !isMobile && detailsOpen && selected;
  // Horizontal fade state for compact scroller
  const [scrollFades, setScrollFades] = React.useState({
    left: false,
    right: false
  });
  React.useEffect(() => {
    if (viewMode !== 'compact') return;
    const el = compactWrapperRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setScrollFades({
        left: scrollLeft > 4,
        right: scrollLeft + clientWidth < scrollWidth - 4
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // wheel horizontal & arrow key navigation
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollBy({ left: e.deltaY, behavior: 'smooth' });
        e.preventDefault();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement)) return;
      if (e.key === 'ArrowRight') {
        el.scrollBy({ left: 160, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        el.scrollBy({ left: -160, behavior: 'smooth' });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      el.removeEventListener('scroll', update);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey, { capture: true } as any);
      ro.disconnect();
    };
  }, [viewMode, open, parsed.length]);

  // Dynamic column width allocation (table mode)
  React.useLayoutEffect(() => {
    if (viewMode !== 'table') return;
    const el = tableWrapperRef.current;
    if (!el) return;
    const compute = () => {
      if (!el) return;
      // total available width inside wrapper (without horizontal scrollbar)
      const wrapperWidth = el.clientWidth;
      if (!wrapperWidth) return;
      const firstColWidth = 160; // approximate width for Field column
      const offerCount = parsed.length || 1;
      const available = Math.max(0, wrapperWidth - firstColWidth - 8); // subtract small gap
      const raw = available / offerCount;
      const width = Math.max(100, Math.min(220, Math.floor(raw)));
      setColWidth(width);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [viewMode, parsed.length]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        overlayClassName='z-overlay-max'
        className='z-overlay-max pointer-events-auto w-[95vw] pt-6 pb-4 sm:max-w-6xl'
        style={{ isolation: 'isolate' }}
        ref={contentRef as any}
      >
        <DialogHeader className='pr-14'>
          <div className='flex flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between'>
            <DialogTitle className='text-base sm:text-lg'>
              Compare Offers
            </DialogTitle>
            <div className='mt-1 flex flex-wrap items-center gap-2 sm:mt-0'>
              <Button
                size='sm'
                variant='outline'
                onClick={exportComparisonPDF}
                className='h-8 gap-1 px-3 text-xs'
              >
                <FileDown className='h-3.5 w-3.5' />
                PDF
              </Button>
              <div className='bg-background/60 flex items-center overflow-hidden rounded-md border shadow-sm'>
                <button
                  type='button'
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'table'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={viewMode === 'table'}
                >
                  <TableIcon className='h-3.5 w-3.5' />
                  <span className='hidden sm:inline'>Table</span>
                </button>
                <div className='bg-border/60 h-5 w-px' />
                <button
                  type='button'
                  onClick={() => setViewMode('compact')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'compact'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-pressed={viewMode === 'compact'}
                >
                  <LayoutGrid className='h-3.5 w-3.5' />
                  <span className='hidden sm:inline'>Compact</span>
                </button>
              </div>
              {/* Duplicate close button removed - panel has its own Close */}
            </div>
          </div>
        </DialogHeader>
        <div
          className={cn(
            'flex max-h-[70vh] min-h-0 gap-4',
            detailsOpen && !isMobile
              ? 'overflow-hidden'
              : 'flex-col overflow-y-auto'
          )}
        >
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col gap-3',
              detailsOpen && !isMobile && 'pr-2'
            )}
          >
            {/* Mobile inline details (desktop uses side panel) */}
            {isMobile && selected && detailsOpen && (
              <div className='bg-muted/40 relative order-[-1] max-h-[320px] overflow-y-auto rounded-md border p-3'>
                <div className='mb-3 flex items-start justify-between gap-3'>
                  <div className='flex flex-col'>
                    <div className='text-sm font-semibold'>
                      Offer #{selected.id}
                    </div>
                    <div className='text-muted-foreground text-[10px]'>
                      Details (ESC to close)
                    </div>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setDetailsOpen(false);
                        setSelected(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className='space-y-2 text-[11px] sm:text-xs'>
                  <details open>
                    <summary className='mb-1 cursor-pointer text-[10px] font-semibold tracking-wide uppercase select-none'>
                      Primary Fields
                    </summary>
                    <div className='mb-1 grid grid-cols-2 gap-2'>
                      {primaryFieldKeys.map((k) => {
                        const f = fields.find((f) => f.key === k);
                        if (!f) return null;
                        const val = renderValue(selected, k);
                        const diff = diffKeys.has(k) && !suppressHighlights;
                        return (
                          <div
                            key={k}
                            className={cn(
                              'flex flex-col gap-0.5 rounded border px-2 py-1',
                              diff
                                ? 'border-accent bg-accent/30 dark:bg-accent/10'
                                : 'bg-background/50 border-transparent'
                            )}
                          >
                            <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                              {f.label}
                            </span>
                            <span className='font-medium break-words'>
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                  <details>
                    <summary className='mb-1 cursor-pointer text-[10px] font-semibold tracking-wide uppercase select-none'>
                      Additional Fields
                    </summary>
                    <div className='grid grid-cols-2 gap-2'>
                      {secondaryFieldKeys.map((k) => {
                        const f = fields.find((f) => f.key === k);
                        if (!f) return null;
                        const val = renderValue(selected, k);
                        const diff = diffKeys.has(k) && !suppressHighlights;
                        return (
                          <div
                            key={k}
                            className={cn(
                              'flex flex-col gap-0.5 rounded border px-2 py-1',
                              diff
                                ? 'border-accent bg-accent/20 dark:bg-accent/10'
                                : 'bg-background/40 border-transparent'
                            )}
                          >
                            <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
                              {f.label}
                            </span>
                            <span className='font-medium break-words'>
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            )}
            {viewMode === 'table' ? (
              <div className='relative flex max-h-[60vh] flex-col overflow-hidden rounded-md border'>
                <div
                  ref={tableWrapperRef}
                  className='max-w-full flex-1 overflow-x-auto overflow-y-auto'
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <table
                    className='w-full border-collapse text-[11px] sm:text-xs md:text-sm'
                    style={colWidth ? { tableLayout: 'fixed' } : undefined}
                  >
                    <thead className='bg-background/95 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-20 backdrop-blur'>
                      <tr>
                        <th
                          className='border-border bg-background sticky left-0 z-30 border-b p-2 text-left shadow-[1px_0_0_0_var(--border)]'
                          style={{ width: 160, minWidth: 140 }}
                        >
                          Field
                        </th>
                        {parsed.map((o, i) => {
                          const idStr = String(o.id);
                          const idx = localOrder.indexOf(idStr);
                          const badgeClass =
                            idx > -1
                              ? colors[idx] ||
                                'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground';
                          return (
                            <th
                              key={o.id}
                              className='border-border bg-background border-b p-2 text-left align-middle'
                              style={
                                colWidth
                                  ? {
                                      width: colWidth,
                                      minWidth: 100,
                                      maxWidth: 240
                                    }
                                  : { minWidth: 140 }
                              }
                            >
                              <div className='flex items-center gap-2'>
                                <span
                                  className={cn(
                                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                                    badgeClass
                                  )}
                                >
                                  {idx + 1}
                                </span>
                                <span className='font-medium'>
                                  Offer {i + 1}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveFields.map((f) => {
                        const isDiffRow =
                          diffKeys.has(f.key) && !suppressHighlights;
                        return (
                          <tr
                            key={f.key}
                            data-field-row={f.key}
                            className={cn(
                              'align-top transition-colors',
                              hoveredField === f.key && 'bg-muted/30'
                            )}
                            onMouseEnter={() => setHoveredField(f.key)}
                            onMouseLeave={() =>
                              setHoveredField((p) => (p === f.key ? null : p))
                            }
                          >
                            <td
                              className={cn(
                                'border-border bg-background sticky left-0 z-10 border-b p-2 font-medium shadow-[1px_0_0_0_var(--border)]',
                                isDiffRow &&
                                  'border-l-accent border-l-2 pl-[6px]'
                              )}
                              style={{ width: 160, minWidth: 140 }}
                            >
                              {f.label}
                            </td>
                            {parsed.map((o) => {
                              const val = renderValue(o, f.key);
                              return (
                                <td
                                  key={o.id + f.key}
                                  className='border-border bg-background border-b p-2 align-top'
                                  style={
                                    colWidth
                                      ? {
                                          width: colWidth,
                                          minWidth: 100,
                                          maxWidth: 240
                                        }
                                      : { minWidth: 140 }
                                  }
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {effectiveFields.length === 0 && (
                        <tr>
                          <td className='border-border bg-background sticky left-0 z-10 border-b p-2 font-medium shadow-[1px_0_0_0_var(--border)]'>
                            No Differences
                          </td>
                          {parsed.map((o) => (
                            <td
                              key={o.id + '-nodiff'}
                              className='border-border text-muted-foreground border-b p-2 text-xs'
                            >
                              —
                            </td>
                          ))}
                        </tr>
                      )}
                      <tr>
                        <td className='border-border bg-background sticky left-0 z-10 border-b p-2 font-medium shadow-[1px_0_0_0_var(--border)]'>
                          Actions
                        </td>
                        {parsed.map((o) => (
                          <td
                            key={o.id + '-action'}
                            className='border-border border-b p-2'
                            style={
                              colWidth
                                ? {
                                    width: colWidth,
                                    minWidth: 100,
                                    maxWidth: 240
                                  }
                                : { minWidth: 140 }
                            }
                          >
                            <Button
                              size='sm'
                              variant='outline'
                              ref={(el) => {
                                if (o.id === selected?.id)
                                  lastTriggerButtonRef.current = el;
                              }}
                              onClick={(e) => {
                                lastTriggerButtonRef.current = e.currentTarget;
                                setPrevSelectedId(selected?.id || null);
                                setSelected(o);
                                setDetailsOpen(true);
                              }}
                            >
                              Details
                            </Button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className='relative'>
                <div
                  ref={compactWrapperRef}
                  className='nv-scroll-hide flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden scroll-smooth py-1 pr-3'
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollPaddingLeft: '0.5rem'
                  }}
                >
                  {parsed.map((o, i) => {
                    const idStr = String(o.id);
                    const idx = localOrder.indexOf(idStr);
                    const badgeClass =
                      idx > -1
                        ? colors[idx] || 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground';
                    const company =
                      (o.details as any).company_name ||
                      (o.details as any).forwarder_company ||
                      '';
                    return (
                      <div
                        key={o.id}
                        className='bg-card hover:border-accent/60 relative flex max-w-[260px] min-w-[240px] snap-start flex-col rounded-lg border p-3 text-xs shadow-sm transition-colors'
                      >
                        <div className='mb-2 flex items-center justify-between gap-2'>
                          <div className='flex min-w-0 items-center gap-2'>
                            <span
                              className={cn(
                                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                badgeClass
                              )}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className='truncate text-[11px] font-medium'
                              title={company || `Offer ${i + 1}`}
                            >
                              {company || `Offer ${i + 1}`}
                            </span>
                          </div>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='h-6 px-2 text-[11px]'
                            onClick={(e) => {
                              lastTriggerButtonRef.current = e.currentTarget;
                              setPrevSelectedId(selected?.id || null);
                              setSelected(o);
                              setDetailsOpen(true);
                            }}
                          >
                            Details
                          </Button>
                        </div>
                        <div className='flex flex-col gap-1'>
                          {effectiveFields.map((f) => {
                            const val = renderValue(o, f.key);
                            const isDiff =
                              diffKeys.has(f.key) && !suppressHighlights;
                            return (
                              <div
                                key={f.key}
                                className={cn(
                                  'flex flex-col rounded border px-2 py-1',
                                  isDiff
                                    ? 'border-accent bg-accent/30 dark:bg-accent/10'
                                    : 'bg-muted/30 border-transparent'
                                )}
                              >
                                <span className='truncate text-[10px] font-medium opacity-70'>
                                  {f.label}
                                </span>
                                <span className='nv-multi-truncate font-mono text-[11px] whitespace-pre-wrap'>
                                  {val}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Edge gradients */}
                {scrollFades.left && (
                  <div className='from-background via-background/80 pointer-events-none absolute top-0 left-0 h-full w-8 bg-gradient-to-r to-transparent' />
                )}
                {scrollFades.right && (
                  <div className='from-background via-background/80 pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l to-transparent' />
                )}
              </div>
            )}
          </div>
          {showSeparator && (
            <div className='bg-border w-px self-stretch rounded-full' />
          )}
          {detailsPanel}
        </div>
      </DialogContent>
    </Dialog>
  );
}
