'use client';
import React from 'react';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listEvents, createEvent, safeFormat } from '@/lib/calendar';

export default function SidepanelCalendar() {
  const [month, setMonth] = React.useState<Date>(new Date());
  const [selected, setSelected] = React.useState<Date | undefined>(new Date());
  const [title, setTitle] = React.useState('');
  const [time, setTime] = React.useState('09:00');
  const [events, setEvents] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    const data = await listEvents(month);
    setEvents(data as any);
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!selected || !title.trim()) return;
    const [hh, mm] = time.split(':').map((n) => parseInt(n, 10));
    const d = new Date(selected);
    d.setHours(hh || 9, mm || 0, 0);
    const res = await createEvent({
      title: title.trim(),
      starts_at: d.toISOString()
    });
    if (res.ok) {
      setTitle('');
      await load();
    }
  }

  const dayList = (
    selected
      ? events.filter(
          (e) =>
            new Date(e.starts_at).toDateString() === selected.toDateString()
        )
      : []
  ) as any[];

  return (
    <div className='space-y-3'>
      <DayCalendar
        mode='single'
        selected={selected}
        onSelect={setSelected}
        month={month}
        onMonthChange={setMonth}
      />
      <div className='grid grid-cols-5 items-end gap-2'>
        <div className='col-span-3'>
          <Label htmlFor='sp-title' className='text-xs'>
            Title
          </Label>
          <Input
            id='sp-title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='h-8 text-sm'
          />
        </div>
        <div className='col-span-1'>
          <Label htmlFor='sp-time' className='text-xs'>
            Time
          </Label>
          <Input
            id='sp-time'
            type='time'
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className='h-8 text-sm'
          />
        </div>
        <div>
          <Button
            className='h-8 w-full'
            disabled={!title.trim()}
            onClick={() => void add()}
          >
            Add
          </Button>
        </div>
      </div>
      <div>
        <div className='mb-1 text-xs font-medium'>
          {selected ? selected.toDateString() : 'Pick a date'}
        </div>
        <div className='space-y-1'>
          {dayList.length === 0 ? (
            <div className='text-muted-foreground text-xs'>No events</div>
          ) : (
            dayList.map((e) => (
              <div
                key={e.id}
                className='flex items-center justify-between rounded border px-2 py-1 text-xs'
              >
                <span className='max-w-[220px] truncate'>{e.title}</span>
                <span className='text-muted-foreground'>
                  {safeFormat(e.starts_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
