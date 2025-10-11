import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

// GET /api/noblesuite/files/stats?folderId=...&recursive=1
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId');
  const recursive = searchParams.get('recursive') === '1';
  if (!folderId)
    return NextResponse.json(
      { ok: false, error: 'FOLDER_ID_REQUIRED' },
      { status: 400 }
    );
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );

  async function getStats(
    id: string
  ): Promise<{ count: number; size: number }> {
    if (recursive) {
      // Use SQL function for recursive aggregation
      const { data, error } = await supabase.rpc('files_stats_recursive', {
        root: id
      });
      if (error || !data) return { count: 0, size: 0 };
      // When using rpc returning table, supabase returns an array; handle both shapes
      const row = Array.isArray(data) ? data[0] : data;
      return { count: Number(row?.count || 0), size: Number(row?.size || 0) };
    }
    // Non-recursive: just direct children
    const { data, error } = await supabase
      .from('files')
      .select('id,type,size_bytes')
      .eq('is_deleted', false)
      .eq('parent_id', id);
    if (error) return { count: 0, size: 0 };
    let size = 0;
    for (const it of data || [])
      if (it.type !== 'folder') size += it.size_bytes || 0;
    return { count: data?.length || 0, size };
  }

  const stats = await getStats(folderId);
  return NextResponse.json({ ok: true, stats });
}
