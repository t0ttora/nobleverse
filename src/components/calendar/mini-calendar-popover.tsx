'use client';
import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarRange, Maximize2, PanelRightOpen, Plus } from 'lucide-react';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';
import { createEvent, listEvents, safeFormat } from '@/lib/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { cn } from '@/lib/utils';
// Use same browser Supabase client import path as Contacts page to avoid multiple client instances
// Share functionality removed temporarily

export type MiniCalendarProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onExpand: () => void;
  onSidePanel: () => void;
  isMobile?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
};

export default function MiniCalendarPopover({
  open,
  onOpenChange,
  onExpand,
  onSidePanel,
  isMobile = false,
  side = 'bottom',
  align = 'end',
  sideOffset = 4,
  alignOffset = 0
}: MiniCalendarProps) {
  const [month, setMonth] = React.useState<Date>(new Date());
  const [selected, setSelected] = React.useState<Date | undefined>(new Date());
  const [title, setTitle] = React.useState('');
  const [time, setTime] = React.useState('09:00');
  // const [sending, setSending] = React.useState(false);
  const [events, setEvents] = React.useState<
    Array<{ id: string; title: string; starts_at: string }>
  >([]);
  // Share removed: related state stripped

  const load = React.useCallback(async () => {
    const data = await listEvents(month);
    setEvents(
      (data || []).map((e) => ({
        id: e.id!,
        title: e.title,
        starts_at: e.starts_at
      }))
    );
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Load team and contacts for Share dropdown
  // Share removed: effect stripped

  async function addQuickEvent() {
    if (!selected || !title.trim()) return;
    // setSending(true);
    try {
      const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
      const starts = new Date(selected);
      starts.setHours(hh || 9, mm || 0, 0, 0);
      const res = await createEvent({
        title: title.trim(),
        starts_at: starts.toISOString()
      });
      if (res.ok) {
        setTitle('');
        await load();
        // Share removed: no notifications
      }
    } finally {
      // setSending(false);
    }
  }

  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size='icon' className='rounded-lg' aria-label='Calendar'>
          <CalendarRange className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={{ bottom: 24 }}
        className='z-[85] flex w-[360px] flex-col overflow-hidden p-0'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <div className='text-sm font-semibold'>Calendar</div>
          <div className='flex items-center gap-1'>
            {/* Add event (icon-only, brand accent) */}
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button
                  size='icon'
                  className='h-8 w-8'
                  style={{
                    color: '#ff5a26',
                    backgroundColor: 'rgba(255,90,38,0.20)'
                  }}
                >
                  <Plus className='h-3.5 w-3.5' />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='bottom'
                align='end'
                className='bg-muted text-foreground w-[380px] space-y-4 border p-4 shadow-lg'
                sideOffset={8}
              >
                <div className='pt-1'>
                  <div className='text-sm font-semibold'>Create event</div>
                  <div className='text-muted-foreground mt-1.5 text-xs'>
                    Pick a date and time, then we’ll add it to your calendar.
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='col-span-2'>
                    <Label className='text-xs'>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder='Event title'
                      className='h-9'
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Date</Label>
                    <Input
                      type='date'
                      value={
                        selected
                          ? new Date(selected).toISOString().slice(0, 10)
                          : new Date().toISOString().slice(0, 10)
                      }
                      onChange={(e) => setSelected(new Date(e.target.value))}
                      className='h-9'
                    />
                  </div>
                  <div>
                    <Label className='text-xs'>Time</Label>
                    <Input
                      type='time'
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className='h-9'
                    />
                  </div>
                  <div className='col-span-2'>
                    <Label className='text-xs'>Notes</Label>
                    <Input placeholder='Optional notes' className='h-9' />
                  </div>
                </div>
                <div className='flex items-center justify-between gap-2'>
                  {/* Share inside create */}
                  <Button
                    size='sm'
                    onClick={() => void addQuickEvent()}
                    disabled={!title.trim()}
                    className='h-8'
                  >
                    Create
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {!isMobile && (
              <>
                <Button
                  variant='ghost'
                  size='icon'
                  title='Side panel'
                  onClick={onSidePanel}
                >
                  <PanelRightOpen className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  title='Expand'
                  onClick={onExpand}
                >
                  <Maximize2 className='size-4' />
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Body: calendar on top, events list for month below */}
        <div className='flex-1 p-3 pt-2'>
          <div className='mx-auto'>
            <div className='mb-2'>
              <DayCalendar
                mode='single'
                selected={selected}
                onSelect={setSelected}
                month={month}
                onMonthChange={setMonth}
                className='w-full rounded-md'
                showOutsideDays={false}
                components={{
                  DayContent: (props: any) => {
                    const date: Date = props.date;
                    const key = date.toDateString();
                    const count = events.filter(
                      (e) => new Date(e.starts_at).toDateString() === key
                    ).length;
                    return (
                      <div className='relative flex h-8 w-8 items-center justify-center'>
                        <span className='text-xs'>{date.getDate()}</span>
                        {count > 0 && (
                          <span className='absolute bottom-0.5 inline-block h-1.5 w-1.5 rounded-full bg-white' />
                        )}
                      </div>
                    );
                  }
                }}
                classNames={{
                  nav_button:
                    'size-7 bg-transparent p-0 border-0 text-foreground/70 hover:text-foreground',
                  caption_label: 'text-sm font-medium'
                }}
              />
            </div>
            {/* Monthly events list inside fixed-height scroll area */}
            <ScrollArea className='mt-3 h-[260px] pr-1'>
              <div className='mx-auto w-[320px] pb-2'>
                <MonthlyEventsList month={month} events={events} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MonthlyEventsList({
  month,
  events
}: {
  month: Date;
  events: Array<{ id: string; title: string; starts_at: string }>;
}) {
  const byDay = React.useMemo(() => {
    const m = new Map<
      string,
      Array<{ id: string; title: string; starts_at: string }>
    >();
    for (const e of events) {
      const d = new Date(e.starts_at);
      if (
        d.getMonth() !== month.getMonth() ||
        d.getFullYear() !== month.getFullYear()
      )
        continue;
      const key = d.toDateString();
      const arr = m.get(key) || [];
      arr.push(e);
      m.set(key, arr);
    }
    // sort days chronologically
    const keys = Array.from(m.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    return keys.map((k) => ({
      key: k,
      items: (m.get(k) || []).sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )
    }));
  }, [events, month]);

  if (byDay.length === 0) {
    return (
      <div className='flex h-full items-start justify-center pt-6'>
        <div className='bg-muted/30 mx-auto w-full rounded-xl border p-6 text-center shadow-sm'>
          <div className='text-sm font-semibold'>No events this month</div>
          <div className='text-muted-foreground mt-1 text-xs leading-relaxed'>
            Use + to quickly add a new event, then share it.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {byDay.map(({ key, items }) => (
        <div key={key} className='mb-3'>
          <div className='text-muted-foreground mb-1 text-[11px] tracking-wide'>
            {new Date(key)
              .toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric'
              })
              .toUpperCase()}
          </div>
          <div className='space-y-1'>
            {items.map((e) => {
              const { fg } = colorFor(e);
              const title = e.title || 'Event';
              const when = safeFormat(e.starts_at);
              return (
                <Tooltip key={e.id}>
                  <TooltipTrigger asChild>
                    <div className='bg-background/60 flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-xs'>
                      <span
                        className='inline-block size-2.5 shrink-0 rounded-full'
                        style={{ backgroundColor: fg }}
                      />
                      <span className='min-w-0 flex-1 truncate' title={title}>
                        {title}
                      </span>
                      <span className='text-muted-foreground shrink-0'>
                        {when}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div className='flex flex-col gap-0.5'>
                      <div className='font-medium'>{title}</div>
                      <div className='text-[11px] opacity-90'>{when}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function colorFor(e: any): { bg: string; fg: string } {
  const key = (e.title || e.id || '').toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const palette = [
    { fg: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
    { fg: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
    { fg: '#059669', bg: 'rgba(5,150,105,0.12)' },
    { fg: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
    { fg: '#d97706', bg: 'rgba(217,119,6,0.12)' }
  ];
  return palette[h % palette.length];
}
