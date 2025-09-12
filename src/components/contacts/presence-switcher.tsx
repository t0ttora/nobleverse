'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { supabase } from '@/../utils/supabase/client';
import { toast } from 'sonner';

type Presence = 'online' | 'offline' | 'dnd';

function Dot({ status }: { status: Presence }) {
  const color =
    status === 'online'
      ? 'bg-green-500'
      : status === 'dnd'
        ? 'bg-red-500'
        : 'bg-gray-400';
  return <span className={`mr-2 inline-block size-2 rounded-full ${color}`} />;
}

export function PresenceSwitcher() {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<Presence>('offline');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) return;
      const { data } = await supabase
        .from('profiles')
        .select('details')
        .eq('id', id)
        .maybeSingle();
      const s = (data?.details as any)?.status as Presence | undefined;
      if (s) setStatus(s);
    })();
  }, []);

  async function update(newStatus: Presence) {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id;
    if (!id) return;
    const { data: current } = await supabase
      .from('profiles')
      .select('details')
      .eq('id', id)
      .maybeSingle();
    const details = { ...((current?.details as any) ?? {}), status: newStatus };
    const { error } = await supabase
      .from('profiles')
      .update({ details, last_active_at: new Date().toISOString() })
      .eq('id', id);
    setLoading(false);
    if (!error) {
      setStatus(newStatus);
      setOpen(false);
      toast.success(`Status updated to ${newStatus}`);
    } else {
      toast.error('Failed to update status');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' disabled={loading}>
          <Dot status={status} />
          <span className='capitalize'>{status}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-48'>
        <div className='space-y-1'>
          {(['online', 'dnd', 'offline'] as Presence[]).map((s) => (
            <button
              key={s}
              type='button'
              onClick={() => void update(s)}
              className='hover:bg-accent flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm'
            >
              <Dot status={s} /> <span className='capitalize'>{s}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
