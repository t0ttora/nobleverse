import { cookies } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/../utils/supabase/server';
import CreateSheetButton from '@/features/cells/components/create-sheet-button';

export default async function WorkbookPage({
  params
}: {
  params: Promise<{ workbookId: string }>;
}) {
  const { workbookId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return (
      <div className='text-muted-foreground p-6 text-sm'>
        Please sign in to view this workbook.
      </div>
    );
  }
  const { data: sheets, error } = await supabase
    .from('sheets')
    .select('*')
    .eq('workbook_id', workbookId)
    .order('idx', { ascending: true });
  const list = sheets ?? [];
  return (
    <div className='flex flex-col gap-4 p-6'>
      <div className='flex items-center gap-3'>
        <div className='flex items-center gap-2'>
          <h3 className='text-sm font-semibold'>Workbook</h3>
          <span className='text-muted-foreground text-[11px]'>
            {workbookId}
          </span>
        </div>
        <CreateSheetButton workbookId={workbookId} />
      </div>
      <div className='flex flex-wrap gap-2'>
        {list.map((s: any) => (
          <Link
            key={s.id}
            href={`/noblesuite/cells/${workbookId}/${s.id}`}
            className='hover:border-primary/40 rounded border px-2 py-1 text-xs hover:shadow-sm'
          >
            {s.name}
          </Link>
        ))}
      </div>
      {list.length === 0 && (
        <div className='text-muted-foreground text-xs'>
          No sheets yet — create one to get started.
        </div>
      )}
    </div>
  );
}
