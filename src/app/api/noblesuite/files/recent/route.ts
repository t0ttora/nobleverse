import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

// GET /api/noblesuite/files/recent?limit=6
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') || 6), 50);
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );

  const base = supabase.from('files');
  let query = base
    .select(
      'id,parent_id,name,type,mime_type,ext,size_bytes,owner_id,version,updated_at,created_at,storage_path,is_starred'
    )
    .eq('is_deleted', false)
    .neq('type', 'folder')
    .order('updated_at', { ascending: false })
    .limit(limit);

  let { data, error } = await query;
  if (error && /column .*is_starred.* does not exist/i.test(error.message)) {
    let query2 = base
      .select(
        'id,parent_id,name,type,mime_type,ext,size_bytes,owner_id,version,updated_at,created_at,storage_path'
      )
      .eq('is_deleted', false)
      .neq('type', 'folder')
      .order('updated_at', { ascending: false })
      .limit(limit);
    const res2 = await query2;
    if (res2.error)
      return NextResponse.json(
        { ok: false, error: res2.error.message },
        { status: 400 }
      );
    const items = (res2.data || []).map((it: any) => ({
      ...it,
      is_starred: false
    }));
    return NextResponse.json({ ok: true, items });
  }
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, items: data });
}
