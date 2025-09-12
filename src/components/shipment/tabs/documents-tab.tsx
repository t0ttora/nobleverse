'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default function DocumentsTab({ shipmentId }: { shipmentId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function refresh() {
    const { data } = await supabase.storage
      .from('shipments')
      .list(shipmentId, { limit: 100 });
    setFiles(data || []);
  }
  useEffect(() => {
    refresh();
  }, [shipmentId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const path = `${shipmentId}/${Date.now()}_${f.name}`;
    await supabase.storage.from('shipments').upload(path, f);
    setUploading(false);
    refresh();
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <input
          id='doc_upload'
          type='file'
          className='hidden'
          onChange={onUpload}
        />
        <Button
          size='sm'
          onClick={() => document.getElementById('doc_upload')?.click()}
          disabled={uploading}
        >
          Upload
        </Button>
      </div>
      <ul className='space-y-1 text-xs'>
        {files.map((f) => (
          <li
            key={f.name}
            className='bg-card/40 flex items-center justify-between rounded border px-2 py-1'
          >
            <span>{f.name}</span>
          </li>
        ))}
        {files.length === 0 && (
          <li className='text-muted-foreground'>No documents.</li>
        )}
      </ul>
    </div>
  );
}
