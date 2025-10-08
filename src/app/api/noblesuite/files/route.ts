import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

// GET /api/noblesuite/files?parentId=&search=&limit=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  const search = searchParams.get('search')?.trim();
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );

  let query = supabase
    .from('files')
    .select(
      'id,parent_id,name,type,mime_type,ext,size_bytes,owner_id,version,updated_at,created_at,storage_path'
    )
    .eq('is_deleted', false)
    .order('type', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);
  if (parentId) query = query.eq('parent_id', parentId);
  else query = query.is('parent_id', null);
  if (search) query = query.ilike('name', `%${search}%`);
  const { data, error } = await query;
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, items: data });
}

// POST /api/noblesuite/files  { name, parentId?, type: 'folder' }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, parentId, type = 'folder' } = body || {};
    if (!name || typeof name !== 'string')
      return NextResponse.json(
        { ok: false, error: 'NAME_REQUIRED' },
        { status: 400 }
      );
    if (!['folder'].includes(type))
      return NextResponse.json(
        { ok: false, error: 'UNSUPPORTED_TYPE_MVP' },
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

    const insert = {
      name: name.trim(),
      parent_id: parentId || null,
      type: 'folder',
      owner_id: auth.user.id
    };
    const { data, error } = await supabase
      .from('files')
      .insert(insert)
      .select('id,name,parent_id,type,created_at')
      .single();
    if (error) {
      if (error.message.includes('duplicate'))
        return NextResponse.json(
          { ok: false, error: 'NAME_CONFLICT' },
          { status: 409 }
        );
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, item: data });
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
  }
}
