'use client';
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SimpleEditorHandle } from '@/components/tiptap-templates/simple/simple-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  PAGE_FORMATS,
  type PageFormat
} from '@/components/tiptap-extensions/pages';

export type PagesViewProps = {
  editorRef: React.MutableRefObject<SimpleEditorHandle | null>;
  children: React.ReactNode;
  format?: PageFormat; // default A4
  headerTemplate?: string; // supports {page} and {total}
  footerTemplate?: string; // supports {page} and {total}
  headerHeight?: number; // px
  footerHeight?: number; // px
  onUpdateHeader?: (value: string) => void;
  onUpdateFooter?: (value: string) => void;
  onFormatChange?: (fmt: PageFormat) => void;
  availableFormats?: PageFormat[];
};

export function PagesView({
  editorRef,
  children,
  format = PAGE_FORMATS.A4,
  headerTemplate = '',
  footerTemplate = '{page} of {total}',
  headerHeight = 50,
  footerHeight = 50,
  onUpdateHeader,
  onUpdateFooter,
  onFormatChange,
  availableFormats
}: PagesViewProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [openHdr, setOpenHdr] = useState(false);
  const [openFtr, setOpenFtr] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

  // If no format prop is passed, read from the editor's Pages extension storage (default A4)
  const effectiveFormat: PageFormat = format;

  const bodyHeight = useMemo(() => {
    return Math.max(
      1,
      effectiveFormat.height -
        headerHeight -
        footerHeight -
        effectiveFormat.margins.top -
        effectiveFormat.margins.bottom
    );
  }, [effectiveFormat, headerHeight, footerHeight]);

  function renderTemplate(t: string, page: number, total: number) {
    return (t || '')
      .replaceAll('{page}', String(page))
      .replaceAll('{total}', String(total));
  }

  // Compute total pages by measuring content height
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.scrollHeight;
      const total = Math.max(1, Math.ceil(h / bodyHeight));
      setTotalPages(total);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bodyHeight, children]);

  // Compute responsive scale to fit the page into available width
  useLayoutEffect(() => {
    const container = outerRef.current;
    if (!container) return;
    const compute = () => {
      const avail = container.clientWidth;
      const s = Math.min(1, avail / effectiveFormat.width);
      setScale(s > 0 ? s : 1);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(container);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [effectiveFormat.width]);

  // Compute current page from selection anchor position
  useEffect(() => {
    const ed = editorRef.current?.getEditor?.();
    if (!ed || !ed.view) return;
    const update = () => {
      try {
        const pos = ed.view.state.selection.anchor;
        const coords = ed.view.coordsAtPos(pos);
        const body = bodyRef.current!;
        const rect = body.getBoundingClientRect();
        const offsetYScaled = coords.top - rect.top + body.scrollTop; // relative to body (scaled)
        const offsetY = offsetYScaled / (scale || 1);
        const page = Math.min(
          totalPages,
          Math.max(1, Math.ceil((offsetY + 1) / bodyHeight))
        );
        setCurrentPage(page);
      } catch {}
    };
    ed.on('selectionUpdate', update);
    ed.on('update', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      ed.off('selectionUpdate', update);
      ed.off('update', update);
      window.removeEventListener('resize', update);
    };
  }, [editorRef, bodyHeight, totalPages, scale]);

  const padStyle: React.CSSProperties = {
    paddingTop: effectiveFormat.margins.top + headerHeight,
    paddingRight: effectiveFormat.margins.right,
    paddingBottom: effectiveFormat.margins.bottom + footerHeight,
    paddingLeft: effectiveFormat.margins.left
  };

  return (
    <div className='w-full bg-[#f7f7f7] py-4 sm:py-6'>
      {/* Print CSS adapting to selected format */}
      <style>{`
                    @media print {
                        @page { size: ${effectiveFormat.width}px ${effectiveFormat.height}px; margin: ${effectiveFormat.margins.top}px ${effectiveFormat.margins.right}px ${effectiveFormat.margins.bottom}px ${effectiveFormat.margins.left}px; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .nv-page { transform: none !important; }
                    }
                `}</style>
      <div className='mx-auto' ref={outerRef}>
        {/* Floating controls: format select + print */}
        <div className='mb-2 flex items-center justify-end gap-2'>
          <div className='text-muted-foreground mr-auto text-xs'>
            Page: {currentPage} / {totalPages}
          </div>
          <Select
            value={effectiveFormat.id}
            onValueChange={(id) => {
              const next =
                (availableFormats || Object.values(PAGE_FORMATS)).find(
                  (f: PageFormat) => f.id === id
                ) || effectiveFormat;
              editorRef.current?.setPageFormat(next);
              onFormatChange?.(next);
            }}
          >
            <SelectTrigger size='sm' className='h-8 w-[120px] px-2'>
              <SelectValue placeholder='Format' />
            </SelectTrigger>
            <SelectContent>
              {(availableFormats || Object.values(PAGE_FORMATS)).map(
                (f: PageFormat) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.id}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Button size='sm' variant='outline' onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <div
          className='mx-auto'
          style={{ width: effectiveFormat.width * scale }}
        >
          <div
            ref={pageRef}
            className='nv-page relative rounded-md border border-[#e3e3e3] shadow-[0_1px_2px_rgba(0,0,0,0.08),_0_4px_14px_rgba(0,0,0,0.08)]'
            style={{
              background: 'white',
              width: effectiveFormat.width,
              minHeight: effectiveFormat.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
          >
            {/* Header overlay */}
            <div
              className='text-muted-foreground absolute right-0 left-0 flex items-center justify-center text-xs'
              style={{
                top: effectiveFormat.margins.top / 2 - 8,
                height: headerHeight,
                cursor: 'text'
              }}
              onDoubleClick={() => setOpenHdr(true)}
            >
              <Popover open={openHdr} onOpenChange={setOpenHdr}>
                <PopoverTrigger asChild>
                  <div className='w-full text-center'>
                    {renderTemplate(headerTemplate, currentPage, totalPages)}
                  </div>
                </PopoverTrigger>
                <PopoverContent align='center' className='w-80'>
                  <div className='space-y-2'>
                    <div className='text-xs font-semibold'>Header</div>
                    <Input
                      value={headerTemplate}
                      placeholder='Header text (use {page} and {total})'
                      onChange={(e) => onUpdateHeader?.(e.target.value)}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onUpdateHeader?.('{page} of {total}')}
                    >
                      Insert page numbers
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Body */}
            <div ref={bodyRef} style={padStyle}>
              {children}
            </div>

            {/* Footer overlay */}
            <div
              className='text-muted-foreground absolute right-0 left-0 flex items-center justify-center text-xs'
              style={{
                bottom: effectiveFormat.margins.bottom / 2 - 8,
                height: footerHeight,
                cursor: 'text'
              }}
              onDoubleClick={() => setOpenFtr(true)}
            >
              <Popover open={openFtr} onOpenChange={setOpenFtr}>
                <PopoverTrigger asChild>
                  <div className='w-full text-center'>
                    {renderTemplate(footerTemplate, currentPage, totalPages)}
                  </div>
                </PopoverTrigger>
                <PopoverContent align='center' className='w-80'>
                  <div className='space-y-2'>
                    <div className='text-xs font-semibold'>Footer</div>
                    <Input
                      value={footerTemplate}
                      placeholder='Footer text (use {page} and {total})'
                      onChange={(e) => onUpdateFooter?.(e.target.value)}
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onUpdateFooter?.('{page} of {total}')}
                    >
                      Insert page numbers
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PagesView;
