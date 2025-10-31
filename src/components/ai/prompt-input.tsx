'use client';
import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Paperclip } from 'lucide-react';

export type PromptInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  showAttach?: boolean;
  onAttachClick?: () => void;
};

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'Ask anything…',
  showAttach = false,
  onAttachClick
}: PromptInputProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize rows
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    const h = el.scrollHeight;
    el.style.height = Math.min(h, 160) + 'px';
  }, [value]);

  return (
    <div className='relative'>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={2}
        placeholder={placeholder}
        className='resize-none rounded-xl border px-10 py-2 pr-12 shadow-sm focus-visible:ring-1'
        disabled={disabled}
      />
      {showAttach && (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='absolute bottom-1.5 left-1.5 h-8 w-8 rounded-full'
          onClick={onAttachClick}
          aria-label='Attach'
          disabled={disabled}
        >
          <Paperclip className='size-4' />
        </Button>
      )}
      <Button
        type='button'
        size='icon'
        className='absolute right-1.5 bottom-1.5 h-8 w-8 rounded-full'
        onClick={onSubmit}
        aria-label='Send'
        disabled={disabled || !value.trim()}
      >
        <SendHorizonal className='size-4' />
      </Button>
      <div className='text-muted-foreground mt-1 pl-1 text-[10px]'>
        Enter to send • Shift+Enter for newline
      </div>
    </div>
  );
}
