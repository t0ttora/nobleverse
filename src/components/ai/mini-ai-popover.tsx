'use client';
import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PromptComposer } from '@/components/ai/prompt-composer';

export type MiniAIProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
  active?: boolean;
};

export default function MiniAIPopover({
  open,
  onOpenChange,
  side = 'bottom',
  align = 'end',
  sideOffset = 4,
  alignOffset = 0,
  active = false
}: MiniAIProps) {
  const [history, setHistory] = React.useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, open]);

  async function sendWithText(q: string) {
    if (!q.trim() || sending) return;
    const nextHistory = [
      ...history,
      { role: 'user' as const, content: q.trim() }
    ];
    setHistory(nextHistory);
    setSending(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory })
      });
      if (!res.ok) {
        const text = await res.text();
        setHistory((h) => [
          ...h,
          {
            role: 'assistant',
            content: 'Sorry, I had an issue reaching the AI. ' + text
          }
        ]);
        return;
      }
      const data = (await res.json()) as { reply?: string };
      const reply = data.reply || '';
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setHistory((h) => [
        ...h,
        {
          role: 'assistant',
          content: 'Request failed: ' + (err?.message || 'Unknown error')
        }
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size='icon'
          variant='ghost'
          className={'rounded-lg ' + (active ? 'bg-foreground/10' : '')}
          aria-label='AI'
        >
          <Bot className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={{ bottom: 24 }}
        className='z-[85] flex h-[540px] w-[360px] flex-col overflow-hidden p-0 md:h-[600px]'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <div className='text-sm font-semibold'>Noble Intelligence</div>
          <Button
            size='icon'
            variant='ghost'
            aria-label='New chat'
            title='New chat'
            onClick={() => {
              setHistory([]);
              setSending(false);
            }}
          >
            <Plus className='size-4' />
          </Button>
        </div>
        {/* Body */}
        <div className='flex min-h-0 flex-1 flex-col p-3'>
          <ScrollArea className='h-0 flex-1 pr-1'>
            <div className='space-y-2 pb-2'>
              {history.length === 0 ? (
                <div className='bg-muted/30 mx-auto w-full rounded-xl border p-6 text-center shadow-sm'>
                  <div className='text-sm font-semibold'>Ask anything</div>
                  <div className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                    Short questions work best. Coming soon: knowledge + actions.
                  </div>
                </div>
              ) : (
                history.map((m, i) => (
                  <div
                    key={i}
                    className={
                      'max-w-[85%] rounded-md border px-3 py-2 text-sm ' +
                      (m.role === 'user'
                        ? 'bg-primary/10 ml-auto'
                        : 'bg-muted/40 mr-auto')
                    }
                  >
                    {m.content}
                  </div>
                ))
              )}
              {sending && (
                <div className='bg-muted/40 text-muted-foreground mr-auto max-w-[85%] rounded-md border px-3 py-2 text-xs'>
                  Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </ScrollArea>
          <div className='mt-2'>
            <PromptComposer
              onSubmit={(msg) => {
                if (msg.text) void sendWithText(msg.text);
              }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
