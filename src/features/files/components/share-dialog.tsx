'use client';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { supabase } from '@/lib/supabaseClient';

export type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: string;
  storagePath: string; // Supabase storage path
};

const EXPIRIES = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: '24 hours', seconds: 24 * 60 * 60 }
];

export default function ShareDialog({
  open,
  onOpenChange,
  bucket,
  storagePath
}: ShareDialogProps) {
  const [seconds, setSeconds] = useState(EXPIRIES[1].seconds);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, seconds);
      if (error) throw error;
      setUrl(data?.signedUrl || null);
    } catch (e) {
      console.error('share link error', e);
      setUrl(null);
    }
    setBusy(false);
  };

  // Note: We will rely on FilesBrowser to pass a pre-generated signed URL instead,
  // to avoid duplicating Supabase client imports here. Keep dialog minimal.

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setUrl(null);
          setCopied(false);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>
            Generate a time-limited link you can share.
          </DialogDescription>
        </DialogHeader>
        <div className='flex items-center gap-2'>
          {EXPIRIES.map((e) => (
            <Button
              key={e.seconds}
              variant={e.seconds === seconds ? 'default' : 'outline'}
              size='sm'
              onClick={() => setSeconds(e.seconds)}
            >
              {e.label}
            </Button>
          ))}
        </div>
        <div className='flex items-center gap-2'>
          <Button size='sm' onClick={() => onOpenChange(false)} variant='ghost'>
            Close
          </Button>
          <Button size='sm' disabled={busy} onClick={generate}>
            Generate
          </Button>
        </div>
        {url && (
          <div className='mt-3 flex items-center gap-2'>
            <input
              readOnly
              value={url}
              className='w-full rounded border px-2 py-1 text-xs'
            />
            <Button
              size='sm'
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? <Icons.check /> : <Icons.share />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
