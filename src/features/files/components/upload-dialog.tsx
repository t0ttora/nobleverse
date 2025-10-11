'use client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called for each file. Should throw on error.
  uploadOne: (
    file: File,
    onProgress?: (percent: number) => void,
    opts?: { signal?: AbortSignal }
  ) => Promise<void>;
  // Optional: max size in bytes for soft validation (default 50MB)
  maxSizeBytes?: number;
}

export default function UploadDialog({
  open,
  onOpenChange,
  uploadOne,
  maxSizeBytes = 50 * 1024 * 1024
}: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<
    {
      id: string;
      file: File;
      status: FileStatus;
      error?: string;
      progress?: number;
    }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const oversizeCount = useMemo(
    () => items.filter((i) => i.file.size > maxSizeBytes).length,
    [items, maxSizeBytes]
  );

  const chooseFiles = () => inputRef.current?.click();

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const next = arr.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      file: f,
      status: 'pending' as FileStatus
    }));
    setItems((prev) => [...prev, ...next]);
    // Do not auto-start; wait for user to click Upload.
  }, []);

  const startUpload = useCallback(
    async (subset?: { id: string; file: File }[]) => {
      const toUpload = subset ?? items;
      if (!toUpload.length) return;
      setBusy(true);
      stoppedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      for (const it of toUpload) {
        if (stoppedRef.current) break;
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: 'uploading', progress: 0 } : p
          )
        );
        try {
          await uploadOne(
            it.file,
            (percent) => {
              setItems((prev) =>
                prev.map((p) =>
                  p.id === it.id ? { ...p, progress: percent } : p
                )
              );
            },
            { signal: controllerRef.current?.signal }
          );
          setItems((prev) =>
            prev.map((p) =>
              p.id === it.id ? { ...p, status: 'done', progress: 100 } : p
            )
          );
        } catch (e: any) {
          const msg =
            controllerRef.current?.signal.aborted || e?.name === 'AbortError'
              ? 'CANCELLED'
              : typeof e?.message === 'string'
                ? e.message
                : 'UPLOAD_FAILED';
          setItems((prev) =>
            prev.map((p) =>
              p.id === it.id ? { ...p, status: 'error', error: msg } : p
            )
          );
          if (controllerRef.current?.signal.aborted) break;
        }
      }
      setBusy(false);
      // Auto-close if everything succeeded (all done, none error/pending)
      const list = itemsRef.current;
      if (list.length > 0 && list.every((i) => i.status === 'done')) {
        onOpenChange(false);
      }
    },
    [items, uploadOne]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length)
      addFiles(e.dataTransfer.files);
  };

  const resetAll = () => setItems([]);

  const cancelUpload = () => {
    if (!busy) return;
    stoppedRef.current = true;
    controllerRef.current?.abort();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className='flex h-[50vh] flex-col overflow-hidden p-0 sm:max-w-xl'>
        <DialogHeader className='px-6 pt-5'>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Choose a file or drag & drop it here. JPEG, PNG, PDF, and MP4
            formats, up to 50 MB.
          </DialogDescription>
        </DialogHeader>

        {/* Drop area */}
        <div
          className={cn(
            'mx-6 my-4 rounded-md border-2 border-dashed p-6 text-center transition',
            dragActive ? 'border-primary bg-primary/5' : 'border-muted'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (
              !(e.currentTarget as HTMLElement).contains(e.relatedTarget as any)
            )
              setDragActive(false);
          }}
          onDrop={onDrop}
          role='button'
          aria-label='Upload area'
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') chooseFiles();
          }}
        >
          <div className='bg-muted mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full'>
            <Icons.file className='text-primary size-5' />
          </div>
          <p className='text-sm'>
            <span className='font-medium'>Choose a file</span> or drag & drop it
            here
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            JPEG, PNG, PDF, and MP4 formats, up to 50 MB.
          </p>
          <div className='mt-4'>
            <Button size='sm' variant='secondary' onClick={chooseFiles}>
              Browse File
            </Button>
            <input
              ref={inputRef}
              type='file'
              multiple
              // Do not restrict accept to avoid any functionality loss; backend can validate
              accept='*/*'
              className='hidden'
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>
        </div>

        {/* Selected list */}
        {items.length > 0 && (
          <div className='mx-6 mb-3 min-h-0 flex-1'>
            <ScrollArea className='h-[28vh] pr-2 sm:h-[36vh]'>
              <div className='space-y-2'>
                {items.map((it) => (
                  <div
                    key={it.id}
                    className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      <span className='inline-flex h-6 w-6 items-center justify-center rounded bg-red-100 text-[10px] font-semibold text-red-700'>
                        {(it.file.name.split('.').pop() || '').toUpperCase() ||
                          'FILE'}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate' title={it.file.name}>
                          {it.file.name}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {Math.round(it.file.size / 1024)} KB •{' '}
                          {it.status === 'uploading' && <span>Uploading…</span>}
                          {it.status === 'done' && (
                            <span className='text-green-600'>Completed</span>
                          )}
                          {it.status === 'pending' && <span>Pending</span>}
                          {it.status === 'error' && (
                            <span className='text-destructive'>
                              Failed
                              {it.error === 'CANCELLED' ? ' (Cancelled)' : ''}
                            </span>
                          )}
                        </div>
                        {it.status === 'uploading' && (
                          <div className='bg-muted mt-1 h-0.5 w-full overflow-hidden rounded'>
                            <div
                              className='bg-primary/70 h-full rounded transition-[width] duration-150'
                              style={{
                                width: `${Math.max(2, Math.min(98, Math.round(it.progress ?? 0)))}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='text-muted-foreground flex items-center gap-2'>
                      {it.status === 'uploading' && (
                        <span className='text-[11px] tabular-nums'>
                          {Math.round(it.progress ?? 0)}%
                        </span>
                      )}
                      {it.status === 'done' && (
                        <span className='h-2.5 w-2.5 rounded-full bg-emerald-500' />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {oversizeCount > 0 && (
          <div className='mb-3 px-6'>
            <Alert className='border-amber-300 bg-amber-50/80'>
              <Icons.warning />
              <AlertTitle>Large files detected</AlertTitle>
              <AlertDescription>
                {oversizeCount} file(s) exceed 50 MB. Uploads above 50 MB may
                fail or be slow.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className='flex items-center justify-between gap-3 border-t px-6 py-4'>
          <div className='text-muted-foreground text-xs'>
            {(() => {
              const total = items.length;
              const done = items.filter((i) => i.status === 'done').length;
              const uploading = items.filter(
                (i) => i.status === 'uploading'
              ).length;
              const avg = items.length
                ? Math.round(
                    items.reduce(
                      (acc, it) =>
                        acc + (it.progress ?? (it.status === 'done' ? 100 : 0)),
                      0
                    ) / items.length
                  )
                : 0;
              return total > 0
                ? `Queue: ${done}/${total} • ${uploading} uploading • ${avg}% total`
                : 'Optimized and responsive uploader';
            })()}
          </div>
          <div className='flex items-center gap-2'>
            {busy && (
              <Button variant='ghost' size='sm' onClick={cancelUpload}>
                Cancel Upload
              </Button>
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              size='sm'
              onClick={() => startUpload()}
              disabled={busy || items.every((i) => i.status !== 'pending')}
            >
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
