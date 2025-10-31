'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Paperclip, Plus, SendHorizonal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export type PromptInputMessage = {
  text: string;
  files?: File[];
};

type Controller = {
  textInput: {
    clear: () => void;
    setInput: (v: string) => void;
    get: () => string;
  };
  attachments: {
    clear: () => void;
    add: (files: FileList | File[]) => void;
    get: () => File[];
  };
};

const PromptCtx = React.createContext<{
  value: string;
  setValue: (v: string) => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onSubmit?: (msg: PromptInputMessage) => void;
} | null>(null);

export function PromptInputProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [value, setValue] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const ctx = React.useMemo(
    () => ({ value, setValue, files, setFiles }),
    [value, files]
  );
  return <PromptCtx.Provider value={ctx}>{children}</PromptCtx.Provider>;
}

export function usePromptInputController(): Controller {
  const ctx = React.useContext(PromptCtx);
  if (!ctx)
    throw new Error(
      'usePromptInputController must be used within PromptInputProvider'
    );
  return {
    textInput: {
      clear: () => ctx.setValue(''),
      setInput: (v: string) => ctx.setValue(v),
      get: () => ctx.value
    },
    attachments: {
      clear: () => ctx.setFiles([]),
      add: (fl) =>
        ctx.setFiles((prev) => [
          ...prev,
          ...Array.from(fl as FileList | File[])
        ]),
      get: () => ctx.files
    }
  };
}

export function PromptInput({
  children,
  onSubmit,
  globalDrop,
  multiple,
  className
}: {
  children: React.ReactNode;
  onSubmit?: (msg: PromptInputMessage) => void;
  globalDrop?: boolean;
  multiple?: boolean;
  className?: string;
}) {
  const ctx = React.useContext(PromptCtx);
  if (!ctx)
    throw new Error('PromptInput must be used within PromptInputProvider');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ text: ctx.value.trim(), files: ctx.files });
  };
  React.useEffect(() => {
    if (!globalDrop) return;
    const onDrop = (ev: DragEvent) => {
      if (!ev.dataTransfer) return;
      const files = ev.dataTransfer.files;
      if (files && files.length) {
        ev.preventDefault();
        ctx.setFiles((prev) => [...prev, ...Array.from(files)]);
      }
    };
    window.addEventListener('drop', onDrop);
    return () => window.removeEventListener('drop', onDrop);
  }, [globalDrop, ctx]);
  const valueObj = React.useMemo(() => ({ ...ctx, onSubmit }), [ctx, onSubmit]);
  return (
    <PromptCtx.Provider value={valueObj}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          'bg-background/60 supports-[backdrop-filter]:bg-background/50 relative rounded-xl border p-3 shadow-sm backdrop-blur',
          className
        )}
      >
        {children}
      </form>
    </PromptCtx.Provider>
  );
}

export function PromptInputHeader({
  children
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className='flex items-center justify-between gap-2'>{children}</div>
  );
}
export function PromptInputBody({ children }: { children?: React.ReactNode }) {
  return <div className='relative'>{children}</div>;
}
export function PromptInputFooter({
  children
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className='mt-1 flex items-center justify-between gap-2'>
      {children}
    </div>
  );
}

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(function PromptInputTextarea(props, ref) {
  const ctx = React.useContext(PromptCtx)!;
  return (
    <textarea
      {...props}
      ref={ref}
      value={ctx.value}
      onChange={(e) => ctx.setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ctx.onSubmit?.({ text: ctx.value.trim(), files: ctx.files });
        }
      }}
      rows={props.rows ?? 3}
      className={cn(
        'w-full resize-none border-0 bg-transparent px-1 pt-2 pb-12 text-sm outline-none',
        props.className
      )}
      placeholder={props.placeholder ?? 'What would you like to know?'}
    />
  );
});

export function PromptInputSubmit({
  status = 'ready' as any
}: {
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
}) {
  const label =
    status === 'submitted'
      ? 'Sending…'
      : status === 'streaming'
        ? 'Thinking…'
        : status === 'error'
          ? 'Retry'
          : 'Send';
  return (
    <Button type='submit' className='h-9 rounded-full px-4'>
      {label}
    </Button>
  );
}

export function PromptInputSubmitIcon({ className }: { className?: string }) {
  return (
    <Button
      type='submit'
      size='icon'
      className={cn(
        'bg-primary text-primary-foreground absolute right-2 bottom-2 h-9 w-9 rounded-full shadow',
        className
      )}
      aria-label='Send'
    >
      <SendHorizonal className='size-4' />
    </Button>
  );
}

export function PromptInputTools({ children }: { children?: React.ReactNode }) {
  return <div className='flex flex-wrap items-center gap-1'>{children}</div>;
}
export function PromptInputButton({
  children
}: {
  children?: React.ReactNode;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='h-8 rounded-full px-2'
    >
      {children}
    </Button>
  );
}

export function PromptInputModelSelect({
  value,
  onValueChange,
  children
}: {
  value: string;
  onValueChange: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      {children}
    </Select>
  );
}
export function PromptInputModelSelectTrigger({
  children
}: {
  children?: React.ReactNode;
}) {
  return <SelectTrigger size='sm' className='h-8' />;
}
export function PromptInputModelSelectValue() {
  return <SelectValue />;
}
export function PromptInputModelSelectContent({
  children
}: {
  children?: React.ReactNode;
}) {
  return <SelectContent>{children}</SelectContent>;
}
export function PromptInputModelSelectItem({
  value,
  children
}: {
  value: string;
  children?: React.ReactNode;
}) {
  return <SelectItem value={value}>{children}</SelectItem>;
}

export function PromptInputActionMenu({
  children
}: {
  children?: React.ReactNode;
}) {
  return <DropdownMenu>{children}</DropdownMenu>;
}
export function PromptInputActionMenuTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-8 w-8 rounded-full'
      >
        ⋯
      </Button>
    </DropdownMenuTrigger>
  );
}
export function PromptInputActionMenuContent({
  children
}: {
  children?: React.ReactNode;
}) {
  return <DropdownMenuContent align='start'>{children}</DropdownMenuContent>;
}
export function PromptInputActionAddAttachments() {
  const controller = usePromptInputController();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          inputRef.current?.click();
        }}
      >
        Add attachments
      </DropdownMenuItem>
      <input
        ref={inputRef}
        type='file'
        multiple
        className='hidden'
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) controller.attachments.add(files);
        }}
      />
    </>
  );
}
export function PromptInputActionAddAttachmentsButton() {
  const controller = usePromptInputController();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-8 w-8 rounded-full'
        onClick={() => inputRef.current?.click()}
        aria-label='Add attachments'
        title='Add attachments'
      >
        <Plus className='size-4' />
      </Button>
      <input
        ref={inputRef}
        type='file'
        multiple
        className='hidden'
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) controller.attachments.add(files);
        }}
      />
    </>
  );
}

// Plus menu popover listing quick insert actions
export function PromptInputPlusMenu() {
  const controller = usePromptInputController();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  function appendText(t: string) {
    const cur = controller.textInput.get();
    controller.textInput.setInput((cur ? cur + ' ' : '') + t);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          aria-label='Add'
        >
          <Plus className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          Add files…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => appendText('[shipment:]')}>
          Insert shipment
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => appendText('[forwarder:]')}>
          Insert forwarder
        </DropdownMenuItem>
      </DropdownMenuContent>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) controller.attachments.add(files);
        }}
      />
    </DropdownMenu>
  );
}

export function PromptInputAttachments({
  children
}: {
  children: (f: File) => React.ReactNode;
}) {
  const { files } = React.useContext(PromptCtx)!;
  if (!files.length) return null;
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {files.map((f, i) => (
        <React.Fragment key={i}>{children(f)}</React.Fragment>
      ))}
    </div>
  );
}
export function PromptInputAttachment({ data }: { data: File }) {
  return (
    <div className='bg-muted/30 flex items-center gap-2 rounded-md border px-2 py-1 text-xs'>
      <Paperclip className='size-3' />
      <span className='max-w-[160px] truncate'>{data.name}</span>
    </div>
  );
}

export function PromptInputSpeechButton({
  textareaRef
}: {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='h-8 w-8 rounded-full'
      title='Voice (stub)'
    >
      <Mic className='size-4' />
    </Button>
  );
}
