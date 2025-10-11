import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH: rename or move
export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const { name, parentId, is_starred, visibility, is_deleted } = body;
  if (
    !name &&
    !('parentId' in body) &&
    !('is_starred' in body) &&
    !('visibility' in body) &&
    !('is_deleted' in body)
  ) {
    return NextResponse.json(
      { ok: false, error: 'NOTHING_TO_UPDATE' },
      { status: 400 }
    );
  }
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }
  if (parentId && parentId === id) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_PARENT' },
      { status: 400 }
    );
  }
  const update: Record<string, any> = {};
  if (typeof name === 'string' && name.trim()) update.name = name.trim();
  if ('parentId' in body) update.parent_id = parentId || null;
  if ('is_starred' in body) update.is_starred = Boolean(is_starred);
  if (
    'visibility' in body &&
    (visibility === 'public' || visibility === 'private')
  )
    update.visibility = visibility;
  if ('is_deleted' in body) update.is_deleted = Boolean(is_deleted);
  let { data, error } = await supabase
    .from('files')
    .update(update)
    .eq('id', id)
    .select(
      'id,name,parent_id,type,updated_at,is_starred,visibility,is_deleted'
    )
    .single();
  if (error && /column .*visibility.* does not exist/i.test(error.message)) {
    const upd2 = { ...update } as any;
    delete upd2.visibility;
    const res2 = await supabase
      .from('files')
      .update(upd2)
      .eq('id', id)
      .select('id,name,parent_id,type,updated_at,is_starred,is_deleted')
      .single();
    data = res2.data as any;
    error = res2.error as any;
  }
  if (error) {
    if (error.message.includes('duplicate')) {
      return NextResponse.json(
        { ok: false, error: 'NAME_CONFLICT' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, item: data });
}

// DELETE: soft delete (do not remove storage to allow undo)
export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }
  const { data: file, error: fileErr } = await supabase
    .from('files')
    .select('id,type,storage_path,owner_id')
    .eq('id', id)
    .single();
  if (fileErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          fileErr.message === 'No rows found' ? 'NOT_FOUND' : fileErr.message
      },
      { status: fileErr.message === 'No rows found' ? 404 : 400 }
    );
  }
  if (file.owner_id !== auth.user.id) {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  const { error: updErr } = await supabase
    .from('files')
    .update({ is_deleted: true })
    .eq('id', id);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: updErr.message },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    removedStorage: false
  });
}
