'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function ChatPanel({
  shipmentId,
  currentUserId
}: {
  shipmentId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    let sub: any;
    async function load() {
      const { data } = await supabase
        .from('shipment_messages')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at');
      setMessages(data || []);
      sub = supabase
        .channel(`realtime:shipment_messages:${shipmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shipment_messages',
            filter: `shipment_id=eq.${shipmentId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT')
              setMessages((m) => [...m, payload.new]);
          }
        )
        .subscribe();
    }
    load();
    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [shipmentId]);

  async function send() {
    const content = text.trim();
    if (!content) return;
    setText('');
    await supabase
      .from('shipment_messages')
      .insert({ shipment_id: shipmentId, user_id: currentUserId, content });
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex-1 space-y-2 overflow-auto p-2 text-xs'>
        {messages.map((m) => (
          <div key={m.id} className='bg-card/40 rounded border p-2'>
            <div className='mb-1 text-[10px] font-medium opacity-70'>
              {m.user_id.slice(0, 6)}
            </div>
            <div>{m.content}</div>
            <div className='mt-1 text-[10px] opacity-50'>
              {new Date(m.created_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className='text-muted-foreground py-4 text-center'>
            No messages yet.
          </div>
        )}
      </div>
      <div className='flex gap-2 border-t p-2'>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Message'
          className='h-8 min-h-8 text-xs'
        />
        <Button size='sm' onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
