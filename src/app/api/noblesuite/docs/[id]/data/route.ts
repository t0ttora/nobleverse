import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export const dynamic = 'force-dynamic';

// This route persists docs content as HTML in a simple key-value table 'docs_data' with columns:
// id (uuid, pk), owner_id (uuid), doc_html (text), updated_at (timestamptz default now())
// If the table doesn't exist, it will fallback to storing content into the files table row's metadata via RPC is not available.

async function getClient() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { supabase, userId: null as string | null };
  return { supabase, userId: auth.user.id as string };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, userId } = await getClient();
  if (!userId)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  const id = params.id;
  // Try docs_data table first
  const { data, error } = await supabase
    .from('docs_data')
    .select('id,doc_html,updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error && /relation .*docs_data.* does not exist/i.test(error.message)) {
    // Fallback: not found
    return NextResponse.json({
      ok: true,
      item: { id, doc_html: '', updated_at: new Date().toISOString() }
    });
  }
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  if (!data)
    return NextResponse.json({
      ok: true,
      item: { id, doc_html: '', updated_at: new Date().toISOString() }
    });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, userId } = await getClient();
  if (!userId)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  const id = params.id;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
  }
  const html = typeof body?.doc_html === 'string' ? body.doc_html : '';
  // Upsert into docs_data
  const { data, error } = await supabase
    .from('docs_data')
    .upsert({ id, owner_id: userId, doc_html: html }, { onConflict: 'id' })
    .select('id,updated_at')
    .single();
  if (error && /relation .*docs_data.* does not exist/i.test(error.message)) {
    // Try create table on-the-fly (best-effort; require appropriate DB perms)
    try {
      await supabase.rpc('exec_sql', {
        sql: `
        create table if not exists public.docs_data (
          id uuid primary key,
          owner_id uuid references public.profiles(id) on delete set null,
          doc_html text not null default '',
          updated_at timestamptz not null default now()
        );
      `
      });
    } catch {}
    // Retry upsert once
    const r2 = await supabase
      .from('docs_data')
      .upsert({ id, owner_id: userId, doc_html: html }, { onConflict: 'id' })
      .select('id,updated_at')
      .single();
    if (r2.error)
      return NextResponse.json(
        { ok: false, error: r2.error.message },
        { status: 400 }
      );
    return NextResponse.json({ ok: true, item: r2.data });
  }
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, item: data });
}
