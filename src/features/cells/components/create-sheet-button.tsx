'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function CreateSheetButton({
  workbookId
}: {
  workbookId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      const name = `Sheet ${new Date().toLocaleTimeString()}`;
      const res = await fetch(
        `/api/noblesuite/cells/workbooks/${workbookId}/sheets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }
      );
      const json = await res.json();
      if (json.ok) {
        const sheetId = json.item?.id;
        if (sheetId)
          window.location.href = `/noblesuite/cells/${workbookId}/${sheetId}`;
      } else {
        setError(json.error || 'CREATE_SHEET_FAILED');
      }
    } catch (e: any) {
      setError(e?.message || 'CREATE_SHEET_FAILED');
    }
    setLoading(false);
  };
  return (
    <div className='flex items-center gap-2'>
      <Button size='sm' onClick={create} disabled={loading} className='gap-1'>
        {loading ? (
          <Icons.spinner className='size-4 animate-spin' />
        ) : (
          <Icons.add className='size-4' />
        )}
        New sheet
      </Button>
      {error && <span className='text-destructive text-xs'>{error}</span>}
    </div>
  );
}
