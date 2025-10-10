import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  const { data, error } = await supabase
    .from('workbooks')
    .select('*')
    .eq('owner_id', auth.user.id)
    .order('updated_at', { ascending: false });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, items: data || [] });
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { title } = body;
  if (!title || typeof title !== 'string')
    return NextResponse.json(
      { ok: false, error: 'TITLE_REQUIRED' },
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
  const { data, error } = await supabase
    .from('workbooks')
    .insert([{ title, owner_id: auth.user.id }])
    .select('*')
    .single();
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  // Create an initial sheet
  const { data: sheet } = await supabase
    .from('sheets')
    .insert([{ workbook_id: data.id, name: 'Sheet 1', idx: 0 }])
    .select('*')
    .single();
  return NextResponse.json({ ok: true, item: data, sheet });
}
