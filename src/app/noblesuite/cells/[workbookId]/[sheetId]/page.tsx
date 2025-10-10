'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

// Lightweight grid placeholder (we can swap to glide-data-grid later)
function SimpleGrid({ sheetId }: { sheetId: string }) {
  const [cells, setCells] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);
  // Load initial cells (basic, full sheet)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('cells')
        .select('row,col,value,formula')
        .eq('sheet_id', sheetId)
        .limit(5000);
      if (!error && data) {
        const map: Record<string, string> = {};
        for (const c of data)
          map[`${c.row}:${c.col}`] = c.formula ?? c.value ?? '';
        setCells(map);
      }
    })();
  }, [sheetId]);
  // Realtime subscribe
  useEffect(() => {
    const channel = supabase
      .channel(`cells-sheet-${sheetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cells',
          filter: `sheet_id=eq.${sheetId}`
        },
        (payload) => {
          const newRow: any = payload.new;
          if (!newRow) return;
          setCells((prev) => ({
            ...prev,
            [`${newRow.row}:${newRow.col}`]:
              newRow.formula ?? newRow.value ?? ''
          }));
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current && supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [sheetId]);
  const rows = 50;
  const cols = 20;
  async function updateCell(r: number, c: number, v: string) {
    setCells((prev) => ({ ...prev, [`${r}:${c}`]: v }));
    await fetch(`/api/noblesuite/cells/sheets/${sheetId}/cells/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells: [{ row: r, col: c, value: v }] })
    });
  }
  return (
    <div className='overflow-auto rounded-md border'>
      <table className='w-full text-xs'>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className='min-w-24 border p-1'>
                  <input
                    className='w-full outline-none'
                    value={cells[`${r}:${c}`] ?? ''}
                    onChange={(e) => updateCell(r, c, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SheetEditorPage() {
  const { workbookId, sheetId } = useParams<{
    workbookId: string;
    sheetId: string;
  }>();
  return (
    <div className='flex flex-col gap-4 p-6'>
      <div className='flex items-center gap-2'>
        <h3 className='text-sm font-semibold'>Sheet</h3>
        <span className='text-muted-foreground text-[11px]'>
          {workbookId} / {sheetId}
        </span>
      </div>
      <div className='flex items-center gap-2'>
        <Button size='sm' variant='outline' className='gap-1'>
          <Icons.fileDescription className='size-4' /> CSV Export (soon)
        </Button>
        <Button size='sm' variant='outline' className='gap-1'>
          <Icons.add className='size-4' /> Add Sheet (soon)
        </Button>
      </div>
      <SimpleGrid sheetId={sheetId} />
    </div>
  );
}
