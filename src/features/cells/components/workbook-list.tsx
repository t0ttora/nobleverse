'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export type Workbook = { id: string; title: string; updated_at: string };

export default function WorkbookList() {
  const [items, setItems] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('Untitled');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/noblesuite/cells/workbooks', {
        cache: 'no-store'
      });
      const json = await res.json();
      if (json.ok) setItems(json.items);
      else setError(json.error || 'LOAD_FAILED');
    } catch (e: any) {
      setError(e?.message || 'LOAD_FAILED');
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/noblesuite/cells/workbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const json = await res.json();
      if (json.ok) {
        setItems((prev) => [json.item, ...prev]);
        // Navigate to the created workbook
        window.location.href = `/noblesuite/cells/${json.item.id}`;
      } else {
        setError(json.error || 'CREATE_FAILED');
      }
    } catch (e: any) {
      setError(e?.message || 'CREATE_FAILED');
    }
    setCreating(false);
  };
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <input
          className='h-8 w-56 rounded border px-2 text-xs'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          size='sm'
          onClick={create}
          disabled={creating || !title.trim()}
          className='gap-1'
        >
          <Icons.add className='size-4' /> New
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={load}
          disabled={loading}
          className='gap-1'
        >
          <Icons.spinner className='size-4' /> Refresh
        </Button>
      </div>
      {error && (
        <div className='text-destructive border-destructive/30 bg-destructive/5 rounded border px-2 py-1 text-xs'>
          {String(error)}
        </div>
      )}
      <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
        {items.map((wb) => (
          <button
            key={wb.id}
            className='group hover:border-primary/40 rounded-lg border p-4 text-left hover:shadow-sm'
            onClick={() => {
              window.location.href = `/noblesuite/cells/${wb.id}`;
            }}
          >
            <div className='flex items-center gap-2'>
              <Icons.file className='text-primary size-5' />
              <div className='truncate text-sm font-medium'>{wb.title}</div>
            </div>
            <div className='text-muted-foreground mt-1 text-[10px]'>
              Updated {new Date(wb.updated_at).toLocaleString()}
            </div>
          </button>
        ))}
        {!loading && items.length === 0 && (
          <div className='text-muted-foreground rounded-md border p-8 text-center text-xs'>
            No workbooks yet
          </div>
        )}
      </div>
    </div>
  );
}
