import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  const { data, error } = await supabase
    .from('sheets')
    .select('*')
    .eq('workbook_id', id)
    .order('idx', { ascending: true });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, items: data || [] });
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name } = body;
  if (!name)
    return NextResponse.json(
      { ok: false, error: 'NAME_REQUIRED' },
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
  // Find max idx
  const { data: maxIdxData } = await supabase
    .from('sheets')
    .select('idx')
    .eq('workbook_id', id)
    .order('idx', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextIdx = (maxIdxData?.idx ?? -1) + 1;
  const { data, error } = await supabase
    .from('sheets')
    .insert([{ workbook_id: id, name, idx: nextIdx }])
    .select('*')
    .single();
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, item: data });
}
