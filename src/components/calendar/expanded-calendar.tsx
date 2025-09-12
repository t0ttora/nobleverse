'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Minimize2, Plus, Share2 } from 'lucide-react';
import {
  createEvent,
  listEvents,
  safeFormat,
  notifyUsersAboutEvent
} from '@/lib/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';

type ViewMode = 'month' | 'week';

export default function ExpandedCalendar({ onClose }: { onClose: () => void }) {
  const [month, setMonth] = React.useState<Date>(new Date());
  const [selected, setSelected] = React.useState<Date | undefined>(new Date());
  const [events, setEvents] = React.useState<any[]>([]);
  const [title, setTitle] = React.useState('');
  const [time, setTime] = React.useState('10:00');
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<ViewMode>('month');
  const [addOpen, setAddOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [color, setColor] = React.useState<string>('#60a5fa'); // default sky
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareTab, setShareTab] = React.useState<'team' | 'contacts'>('team');
  const [search, setSearch] = React.useState('');
  const [team, setTeam] = React.useState<Array<{ id: string; name: string }>>(
    []
  );
  const [contacts, setContacts] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await listEvents(month);
    setEvents(data as any);
    setLoading(false);
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!selected || !title.trim()) return;
    const [hh, mm] = time.split(':').map((n) => parseInt(n, 10));
    const d = new Date(selected);
    d.setHours(hh || 10, mm || 0, 0, 0);
    const res = await createEvent({
      title: title.trim(),
      starts_at: d.toISOString(),
      notes
    });
    if (res.ok) {
      setTitle('');
      setNotes('');
      // optional: notify selected contacts when sharing
      if (selectedIds.length) {
        void notifyUsersAboutEvent(selectedIds, {
          title,
          starts_at: d.toISOString(),
          notes
        } as any);
      }
      await load();
    }
  }

  // contacts/team for filtering multi-select
  React.useEffect(() => {
    let alive = true;
    async function fetchContacts() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data: pairs } = await supabase
          .from('contacts')
          .select('contact_id')
          .eq('user_id', uid);
        const ids = (pairs || []).map((p: any) => p.contact_id);
        if (!ids.length) {
          setContacts([]);
          return;
        }
        const { data: profs } = await supabase
          .from('profiles')
          .select('id,display_name,username')
          .in('id', ids);
        if (!alive) return;
        setContacts(
          (profs || []).map((p: any) => ({
            id: p.id,
            name: (p.display_name || p.username || 'User') as string
          }))
        );
        // team via company_name
        const { data: me } = await supabase
          .from('profiles')
          .select('id,company_name')
          .eq('id', uid)
          .single();
        const company = (me as any)?.company_name || null;
        if (company) {
          const { data: tprofs } = await supabase
            .from('profiles')
            .select('id,display_name,username,company_name')
            .eq('company_name', company);
          if (!alive) return;
          setTeam(
            (tprofs || [])
              .filter((p: any) => p.id !== uid)
              .map((p: any) => ({
                id: p.id,
                name: (p.display_name || p.username || 'User') as string
              }))
          );
        }
      } catch {
        /* ignore */
      }
    }
    void fetchContacts();
    return () => {
      alive = false;
    };
  }, []);

  // Events grouped by date string
  const byDate = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of events) {
      const key = new Date(e.starts_at).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const selKey = selected ? selected.toDateString() : '';
  const dayEvents = byDate[selKey] || [];

  // Header action content (Add Event dropdown)
  function AddEvent() {
    return (
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button
            className='h-8 px-3 text-[13px]'
            style={{
              color: '#ff5a26',
              backgroundColor: 'rgba(255,90,38,0.20)'
            }}
          >
            <Plus className='mr-1 h-3.5 w-3.5' /> Add event
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side='bottom'
          align='end'
          className='bg-muted w-[520px] space-y-4 border p-5 shadow-lg'
        >
          <div className='pt-1'>
            <div className='text-sm font-semibold'>Create an event</div>
            <div className='text-muted-foreground mt-1.5 text-xs'>
              Add title, pick date and time. You can share with teammates after
              creating.
            </div>
          </div>
          <div className='grid grid-cols-6 gap-3'>
            <div className='col-span-4'>
              <Label className='text-xs'>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Event title'
                className='h-9'
              />
            </div>
            <div className='col-span-2'>
              <Label className='text-xs'>Color</Label>
              <input
                type='color'
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className='h-9 w-full rounded border'
              />
            </div>
            <div className='col-span-3'>
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
            <div className='col-span-3'>
              <Label className='text-xs'>Time</Label>
              <Input
                type='time'
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className='h-9'
              />
            </div>
            <div className='col-span-6'>
              <Label className='text-xs'>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Optional notes'
                className='h-9'
              />
            </div>
          </div>
          <div className='flex items-center justify-between'>
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button variant='outline' size='sm' className='h-8'>
                  <Share2 className='mr-1 size-4' /> Share
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side='bottom'
                align='start'
                className='text-foreground w-[380px] space-y-3 border bg-white p-3 shadow-lg dark:bg-black dark:text-white'
              >
                <div>
                  <div className='text-sm font-semibold'>Share your event</div>
                  <div className='text-muted-foreground text-xs'>
                    Select teammates or contacts to notify.
                  </div>
                </div>
                <Tabs
                  value={shareTab}
                  onValueChange={(v) => setShareTab(v as any)}
                  className='w-full'
                >
                  <TabsList className='mb-2'>
                    <TabsTrigger value='team'>Team</TabsTrigger>
                    <TabsTrigger value='contacts'>Contacts</TabsTrigger>
                  </TabsList>
                  <div className='mb-2'>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder='Search'
                      className='h-8'
                    />
                  </div>
                  <TabsContent value='team'>
                    <PeopleList
                      list={team}
                      search={search}
                      selected={selectedIds}
                      onChange={setSelectedIds}
                    />
                  </TabsContent>
                  <TabsContent value='contacts'>
                    <PeopleList
                      list={contacts}
                      search={search}
                      selected={selectedIds}
                      onChange={setSelectedIds}
                    />
                  </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
            <Button
              disabled={!title.trim()}
              onClick={() => {
                void add();
                setAddOpen(false);
              }}
            >
              Create
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className='bg-background/80 fixed inset-0 z-[70] flex flex-col'
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        className='bg-background m-[50px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-2xl'
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between border-b px-5 py-3'>
          <div className='text-sm font-semibold'>Calendar</div>
          {/* Centered month navigation */}
          <div className='flex flex-1 items-center justify-center'>
            <div className='flex items-center gap-2'>
              <button
                className='rounded border px-2 py-1 text-xs'
                onClick={() =>
                  setMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
              >
                {'<'}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className='w-40 rounded border px-2 py-1 text-center text-xs font-medium'
                    title='Pick month'
                  >
                    {month.toLocaleString(undefined, {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </button>
                </PopoverTrigger>
                <PopoverContent align='center' className='p-2'>
                  <DayCalendar
                    mode='single'
                    selected={month}
                    onSelect={(d: any) => {
                      if (d) setMonth(new Date(d));
                    }}
                    captionLayout='dropdown'
                    fromYear={2015}
                    toYear={2035}
                  />
                </PopoverContent>
              </Popover>
              <button
                className='rounded border px-2 py-1 text-xs'
                onClick={() =>
                  setMonth(
                    (prev) =>
                      new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
              >
                {'>'}
              </button>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='bg-muted/30 rounded-md border p-0.5 text-xs'>
              <button
                className={cn(
                  'rounded px-2 py-1',
                  view === 'week' ? 'bg-background shadow' : ''
                )}
                onClick={() => setView('week')}
              >
                Week
              </button>
              <button
                className={cn(
                  'rounded px-2 py-1',
                  view === 'month' ? 'bg-background shadow' : ''
                )}
                onClick={() => setView('month')}
              >
                Month
              </button>
            </div>
            <AddEvent />
            <Button
              variant='ghost'
              size='icon'
              title='Collapse'
              onClick={onClose}
            >
              <Minimize2 className='size-4' />
            </Button>
          </div>
        </div>
        <div className='min-h-0 flex-1'>
          {view === 'month' ? (
            <div className='grid h-full min-h-0 grid-cols-12 gap-4 p-4'>
              <div className='col-span-8 min-h-0 overflow-auto rounded-md border p-2'>
                <MonthGrid
                  month={month}
                  events={events}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div className='col-span-4 flex min-h-0 flex-col rounded-md border p-3'>
                <div className='mb-2 text-sm font-medium'>
                  {selected ? selected.toDateString() : 'Select a day'}
                </div>
                <div
                  className={cn(
                    'flex-1 overflow-auto',
                    loading && 'opacity-70'
                  )}
                >
                  {dayEvents.length === 0 ? (
                    <div className='text-muted-foreground text-xs'>
                      No events
                    </div>
                  ) : (
                    <ul className='space-y-2'>
                      {dayEvents.map((e) => {
                        const { bg, fg } = colorFor(e);
                        return (
                          <li
                            key={e.id}
                            className='flex items-center gap-2 rounded-md border p-2'
                          >
                            <span
                              className='inline-block size-2.5 rounded-full'
                              style={{ backgroundColor: fg }}
                            />
                            <div className='min-w-0'>
                              <div
                                className='truncate text-sm font-medium'
                                style={{ color: fg }}
                              >
                                {e.title}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {safeFormat(e.starts_at)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className='grid h-full min-h-0 grid-cols-12 gap-4 p-4'>
              <div className='col-span-8 min-h-0 overflow-auto rounded-md border p-2'>
                <WeekGrid
                  events={events}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div className='col-span-4 flex min-h-0 flex-col rounded-md border p-3'>
                <div className='mb-2 text-sm font-medium'>
                  {selected ? selected.toDateString() : 'Select a day'}
                </div>
                <div
                  className={cn(
                    'flex-1 overflow-auto',
                    loading && 'opacity-70'
                  )}
                >
                  {dayEvents.length === 0 ? (
                    <div className='text-muted-foreground text-xs'>
                      No events
                    </div>
                  ) : (
                    <ul className='space-y-2'>
                      {dayEvents.map((e) => {
                        const { fg } = colorFor(e);
                        return (
                          <li
                            key={e.id}
                            className='flex items-center gap-2 rounded-md border p-2'
                          >
                            <span
                              className='inline-block size-2.5 rounded-full'
                              style={{ backgroundColor: fg }}
                            />
                            <div className='min-w-0'>
                              <div
                                className='truncate text-sm font-medium'
                                style={{ color: fg }}
                              >
                                {e.title}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {safeFormat(e.starts_at)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WeekGrid({
  events,
  selected,
  onSelect
}: {
  events: any[];
  selected?: Date;
  onSelect: (d: Date | undefined) => void;
}) {
  // Simple week view renderer inspired by the user mock; not full drag-drop
  const start = selected ? startOfWeek(selected) : startOfWeek(new Date());
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const hours = [...Array(11)].map((_, i) => 8 + i); // 8–18
  const slots: Record<string, any[]> = {};
  for (const e of events) {
    const d = new Date(e.starts_at);
    const key = `${d.toDateString()}@${d.getHours()}`;
    (slots[key] ||= []).push(e);
  }
  return (
    <div className='p-4'>
      <div
        className='grid'
        style={{ gridTemplateColumns: `80px repeat(7, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d.toDateString()}
            className='pb-2 text-center text-xs font-medium'
          >
            {d.toDateString().slice(0, 10)}
          </div>
        ))}
        {hours.map((h) => (
          <React.Fragment key={h}>
            <div className='text-muted-foreground border-b py-3 pr-2 text-right text-xs'>
              {h}:00
            </div>
            {days.map((d) => {
              const key = `${d.toDateString()}@${h}`;
              const items = slots[key] || [];
              return (
                <div
                  key={key}
                  className='relative min-h-[48px] border-b border-l'
                >
                  {items.map((e: any, idx: number) => {
                    const { bg, fg } = colorFor(e);
                    return (
                      <div
                        key={e.id || idx}
                        className='absolute top-1 right-1 left-1 rounded-md px-2 py-1 text-xs'
                        style={{
                          backgroundColor: bg,
                          borderLeft: `3px solid ${fg}`
                        }}
                      >
                        <div
                          className='truncate font-medium'
                          style={{ color: fg }}
                        >
                          {e.title}
                        </div>
                        <div className='text-muted-foreground text-[10px]'>
                          {safeFormat(e.starts_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, i: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + i);
  return x;
}

function startOfMonthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfWeek(first);
}

function MonthGrid({
  month,
  events,
  selected,
  onSelect
}: {
  month: Date;
  events: any[];
  selected?: Date;
  onSelect: (d: Date | undefined) => void;
}) {
  const start = startOfMonthGrid(month);
  const days = [...Array(42)].map((_, i) => addDays(start, i)); // 6 weeks view
  const byKey: Record<string, any[]> = {};
  for (const e of events) {
    const d = new Date(e.starts_at);
    const key = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    ).toDateString();
    (byKey[key] ||= []).push(e);
  }
  return (
    <div className='bg-border grid grid-cols-7 gap-px overflow-hidden rounded-md text-xs'>
      {/* Weekday headers (Sunday-first) */}
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
        <div key={`h-${w}`} className='bg-muted/40 p-2 text-center font-medium'>
          {w}
        </div>
      ))}
      {days.map((d, idx) => {
        const inMonth = d.getMonth() === month.getMonth();
        const key = d.toDateString();
        const items = (byKey[key] || []) as any[];
        const isSel = selected && d.toDateString() === selected.toDateString();
        return (
          <div
            key={idx}
            className={cn(
              'bg-background min-h-[86px] border-t p-2',
              !inMonth && 'opacity-50',
              isSel && 'ring-primary ring-2'
            )}
            onClick={() => onSelect(new Date(d))}
            role='button'
          >
            <div className='mb-1 text-[11px] font-medium'>{d.getDate()}</div>
            <div className='space-y-1'>
              {items.slice(0, 3).map((e: any) => {
                const { bg, fg } = colorFor(e);
                return (
                  <div
                    key={e.id}
                    className='truncate rounded-sm px-2 py-1'
                    title={e.title}
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    {e.title}
                  </div>
                );
              })}
              {items.length > 3 && (
                <div className='text-muted-foreground text-[10px]'>
                  +{items.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// simple palette color helper
function colorFor(e: any): { bg: string; fg: string } {
  const key = (e.title || e.id || '').toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const palette = [
    { fg: '#2563eb', bg: 'rgba(37,99,235,0.12)' }, // blue
    { fg: '#7c3aed', bg: 'rgba(124,58,237,0.12)' }, // violet
    { fg: '#059669', bg: 'rgba(5,150,105,0.12)' }, // emerald
    { fg: '#dc2626', bg: 'rgba(220,38,38,0.12)' }, // red
    { fg: '#d97706', bg: 'rgba(217,119,6,0.12)' } // amber
  ];
  return palette[h % palette.length];
}

function PeopleList({
  list,
  search,
  selected,
  onChange
}: {
  list: Array<{ id: string; name: string }>;
  search: string;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const filtered = React.useMemo(() => {
    const q = (search || '').toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [list, search]);
  return (
    <div className='max-h-52 overflow-auto rounded-md border p-2'>
      <ul className='space-y-1 text-sm'>
        {filtered.map((p) => {
          const checked = selected.includes(p.id);
          return (
            <li key={p.id}>
              <label className='inline-flex cursor-pointer items-center gap-2'>
                <input
                  type='checkbox'
                  checked={checked}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, p.id]
                        : selected.filter((x) => x !== p.id)
                    )
                  }
                />
                <span>{p.name}</span>
              </label>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className='text-muted-foreground text-xs'>No matches</li>
        )}
      </ul>
    </div>
  );
}

function MultiSelectChips({
  options,
  selected,
  onChange
}: {
  options: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = React.useState('');
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className='rounded-md border p-2'>
      <Input
        placeholder='Search people'
        className='mb-2 h-8'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className='mb-2 flex flex-wrap gap-1'>
        {selected.map((id) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <span
              key={id}
              className='bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs'
            >
              {opt.name}
              <button
                className='text-muted-foreground'
                onClick={() => onChange(selected.filter((x) => x !== id))}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <ul className='max-h-40 space-y-1 overflow-auto text-sm'>
        {filtered.map((o) => {
          const checked = selected.includes(o.id);
          return (
            <li key={o.id}>
              <label className='inline-flex cursor-pointer items-center gap-2'>
                <input
                  type='checkbox'
                  checked={checked}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, o.id]
                        : selected.filter((x) => x !== o.id)
                    )
                  }
                />
                <span>{o.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
