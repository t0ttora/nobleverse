'use client';
import React, { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function AvatarUploader({
  value,
  onChange,
  bucket = 'avatars'
}: {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectFile = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      onChange(publicUrl);
    } catch {
      // no-op UI; could add toast in the future
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className='flex items-center gap-3'>
      <div className='flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800'>
        {value && value.trim() ? (
          <img
            src={value}
            alt='avatar'
            className='h-full w-full object-cover'
          />
        ) : (
          <span className='text-muted-foreground text-xs'>No avatar</span>
        )}
      </div>
      <div className='flex gap-2'>
        <button
          type='button'
          onClick={selectFile}
          className='rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50'
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload Avatar'}
        </button>
        {value && (
          <button
            type='button'
            className='rounded bg-zinc-100 px-3 py-2 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
            onClick={() => onChange('')}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        hidden
        onChange={(e) => {
          void onFile(e);
        }}
      />
    </div>
  );
}
