'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  SendHorizonal,
  Paperclip,
  File as FileIcon,
  Package,
  Building2,
  Users,
  ClipboardList,
  CreditCard,
  BarChart3,
  Settings,
  BookText,
  HelpCircle,
  SquarePlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

type AttachmentType =
  | 'cells'
  | 'doc'
  | 'shipment'
  | 'forwarder'
  | 'order'
  | 'contact'
  | 'payment'
  | 'kpi';

type AttachmentItem = { id: string; label: string };

export type PromptComposerMessage = {
  text: string;
  files?: File[];
  attachments?: Record<AttachmentType, AttachmentItem[]>;
};

export function PromptComposer({
  onSubmit,
  className,
  placeholder = 'What would you like to know?'
}: {
  onSubmit?: (msg: PromptComposerMessage) => void;
  className?: string;
  placeholder?: string;
}) {
  const [value, setValue] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [attachments, setAttachments] = React.useState<
    Record<AttachmentType, AttachmentItem[]>
  >({} as any);
  const [activeChip, setActiveChip] = React.useState<AttachmentType | null>(
    null
  );
  const [sending, setSending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    // Auto-resize up to ~6 lines
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const h = Math.min(el.scrollHeight, 160);
    el.style.height = h + 'px';
  }, [value]);

  function appendToken(token: string) {
    // Append a small helper token to the input; caret remains at end
    setValue((v) => (v ? v + ' ' + token : token));
  }

  function submit() {
    const text = value.trim();
    if (!text || sending) return;
    onSubmit?.({ text, files, attachments });
    setValue('');
    setFiles([]);
    setAttachments({} as any);
  }

  function ensureChip(type: AttachmentType, openAfter = false) {
    setAttachments((prev) => {
      if (prev[type] && prev[type].length >= 0) return prev;
      return { ...prev, [type]: [] } as any;
    });
    if (openAfter) setActiveChip(type);
  }

  function updateChip(type: AttachmentType, nextItems: AttachmentItem[]) {
    setAttachments((prev) => ({ ...prev, [type]: nextItems }) as any);
  }

  function removeChip(type: AttachmentType) {
    setAttachments((prev) => {
      const copy = { ...prev } as Record<AttachmentType, AttachmentItem[]>;
      delete copy[type];
      return copy as any;
    });
  }

  const CHIP_LABEL: Record<AttachmentType, string> = {
    cells: 'Cells',
    doc: 'Doc',
    shipment: 'Shipment',
    forwarder: 'Forwarder',
    order: 'Order',
    contact: 'Contact',
    payment: 'Payment',
    kpi: 'KPI'
  };

  const MOCK_OPTIONS: Record<AttachmentType, AttachmentItem[]> = {
    cells: [
      { id: 'cells-q1', label: 'Q1 Planning' },
      { id: 'cells-ops', label: 'Ops Checklist' },
      { id: 'cells-pricing', label: 'Pricing Matrix' }
    ],
    doc: [
      { id: 'doc-brief', label: 'Feature Brief' },
      { id: 'doc-sop', label: 'SOP - Onboarding' },
      { id: 'doc-terms', label: 'Shipping Terms' }
    ],
    shipment: [
      { id: 'SHP-10234', label: 'SHP-10234' },
      { id: 'SHP-10267', label: 'SHP-10267' },
      { id: 'SHP-10301', label: 'SHP-10301' }
    ],
    forwarder: [
      { id: 'FWD-BlueSky', label: 'BlueSky Logistics' },
      { id: 'FWD-TransGlobal', label: 'TransGlobal' },
      { id: 'FWD-SeaWave', label: 'SeaWave' }
    ],
    order: [
      { id: 'ORD-5501', label: 'ORD-5501' },
      { id: 'ORD-5502', label: 'ORD-5502' },
      { id: 'ORD-5503', label: 'ORD-5503' }
    ],
    contact: [
      { id: 'USR-anna', label: 'Anna Schmidt' },
      { id: 'USR-lee', label: 'Lee Wong' },
      { id: 'USR-omar', label: 'Omar El-Sayed' }
    ],
    payment: [
      { id: 'PMT-9001', label: 'PMT-9001' },
      { id: 'PMT-9002', label: 'PMT-9002' }
    ],
    kpi: [
      { id: 'KPI-OTD', label: 'On-Time Delivery' },
      { id: 'KPI-COST', label: 'Cost per Shipment' },
      { id: 'KPI-NPS', label: 'NPS' }
    ]
  };

  function TypeIcon({
    type,
    className
  }: {
    type: AttachmentType;
    className?: string;
  }) {
    if (type === 'cells')
      return (
        <Icons.sheet className={cn('size-3.5 text-green-600', className)} />
      );
    if (type === 'doc')
      return <Icons.doc className={cn('size-3.5 text-blue-600', className)} />;
    if (type === 'shipment')
      return <Package className={cn('size-3.5', className)} />;
    if (type === 'forwarder')
      return <Building2 className={cn('size-3.5', className)} />;
    if (type === 'order')
      return <ClipboardList className={cn('size-3.5', className)} />;
    if (type === 'contact')
      return <Users className={cn('size-3.5', className)} />;
    if (type === 'payment')
      return <CreditCard className={cn('size-3.5', className)} />;
    if (type === 'kpi')
      return <BarChart3 className={cn('size-3.5', className)} />;
    return null;
  }

  function AttachmentChip({
    type,
    items,
    onChange,
    onRemove,
    forceOpen,
    onForceHandled
  }: {
    type: AttachmentType;
    items: AttachmentItem[];
    onChange: (next: AttachmentItem[]) => void;
    onRemove: () => void;
    forceOpen?: boolean;
    onForceHandled?: () => void;
  }) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const options = React.useMemo(() => {
      const base = MOCK_OPTIONS[type] || [];
      const q = query.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        (o) =>
          o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
      );
    }, [type, query]);

    React.useEffect(() => {
      if (forceOpen) {
        setOpen(true);
        onForceHandled?.();
      }
    }, [forceOpen, onForceHandled]);

    function toggle(id: string) {
      const exists = items.some((i) => i.id === id);
      if (exists) onChange(items.filter((i) => i.id !== id));
      else {
        const found = (MOCK_OPTIONS[type] || []).find((o) => o.id === id);
        if (found) onChange([...items, found]);
      }
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            className='bg-muted/30 hover:bg-muted/50 pointer-events-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]'
            title={CHIP_LABEL[type]}
          >
            <TypeIcon type={type} />
            <span>
              {CHIP_LABEL[type]}
              {items.length ? ` (${items.length})` : ''}
            </span>
            <span
              className='text-muted-foreground hover:text-foreground ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-xs'
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label='Remove'
            >
              ×
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align='start' className='w-[260px] p-3'>
          <div className='mb-2 text-xs font-semibold'>{CHIP_LABEL[type]}</div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Search ' + CHIP_LABEL[type]}
            className='mb-2 h-8'
          />
          <ScrollArea className='max-h-48 pr-2'>
            <div className='space-y-1'>
              {options.map((o) => {
                const checked = items.some((i) => i.id === o.id);
                return (
                  <label
                    key={o.id}
                    className='hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1'
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(o.id)}
                    />
                    <div className='text-sm'>
                      <div className='font-medium'>{o.label}</div>
                      <div className='text-muted-foreground text-[11px]'>
                        {o.id}
                      </div>
                    </div>
                  </label>
                );
              })}
              {options.length === 0 && (
                <div className='text-muted-foreground px-2 py-6 text-center text-xs'>
                  No options
                </div>
              )}
            </div>
          </ScrollArea>
          <div className='mt-2 flex items-center justify-between'>
            <Button
              size='sm'
              variant='ghost'
              className='h-8'
              onClick={() => onChange([])}
            >
              Clear
            </Button>
            <Button size='sm' className='h-8' onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className={cn(
        'bg-background/60 supports-[backdrop-filter]:bg-background/50 relative rounded-lg border p-2 shadow-sm backdrop-blur',
        className
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder={placeholder}
        className='w-full resize-none bg-transparent px-1 pt-1 pb-10 text-sm outline-none'
      />

      {/* Tools row */}
      <div className='pointer-events-none absolute bottom-2 left-2 flex items-center gap-1'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='pointer-events-auto h-8 w-8 rounded-full'
              aria-label='Add'
            >
              <Plus className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='z-[1100] min-w-[220px]'>
            {/* Attach submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className='gap-2'>
                <Paperclip className='size-4' />
                <span>Attach</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileIcon className='mr-2 size-4' />
                  <span>File</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('cells', true)}>
                  <Icons.sheet className='mr-2 size-4 text-green-600' />
                  <span>Cells</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('doc', true)}>
                  <Icons.doc className='mr-2 size-4 text-blue-600' />
                  <span>Doc</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {/* Insert submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className='gap-2'>
                <SquarePlus className='size-4' />
                <span>Insert</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => ensureChip('shipment', true)}>
                  <Package className='mr-2 size-4' />
                  <span>Shipment</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => ensureChip('forwarder', true)}
                >
                  <Building2 className='mr-2 size-4' />
                  <span>Forwarder</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('order', true)}>
                  <ClipboardList className='mr-2 size-4' />
                  <span>Order</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('contact', true)}>
                  <Users className='mr-2 size-4' />
                  <span>Contact</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('payment', true)}>
                  <CreditCard className='mr-2 size-4' />
                  <span>Payment</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ensureChip('kpi', true)}>
                  <BarChart3 className='mr-2 size-4' />
                  <span>KPI</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {/* Help submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className='gap-2'>
                <HelpCircle className='size-4' />
                <span>Help</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => appendToken('[docs:]')}>
                  <BookText className='mr-2 size-4' />
                  <span>Docs</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => appendToken('[settings:]')}>
                  <Settings className='mr-2 size-4' />
                  <span>Settings</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Attachment chips */}
        {Object.keys(attachments).map((t) => {
          const type = t as AttachmentType;
          return (
            <AttachmentChip
              key={type}
              type={type}
              items={attachments[type] || []}
              onChange={(next) => updateChip(type, next)}
              onRemove={() => removeChip(type)}
              forceOpen={activeChip === type}
              onForceHandled={() => setActiveChip(null)}
            />
          );
        })}
        {files.length > 0 && (
          <div className='pointer-events-auto hidden items-center gap-1 sm:flex'>
            {files.slice(0, 3).map((f, i) => (
              <div
                key={i}
                className='bg-muted/30 flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]'
              >
                <Paperclip className='size-3' />
                <span className='max-w-[120px] truncate'>{f.name}</span>
              </div>
            ))}
            {files.length > 3 && (
              <div className='bg-muted/30 rounded-md border px-1.5 py-0.5 text-[10px]'>
                +{files.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        onChange={(e) => {
          const list = e.target.files;
          if (!list || !list.length) return;
          setFiles((prev) => [...prev, ...Array.from(list)]);
        }}
      />

      {/* Send button */}
      <Button
        type='button'
        size='icon'
        className='absolute right-2 bottom-2 h-9 w-9 rounded-full'
        disabled={!value.trim()}
        onClick={submit}
        aria-label='Send'
      >
        <SendHorizonal className='size-4' />
      </Button>
    </div>
  );
}
