import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/../utils/supabase/server';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });
  const { data, error } = await supabase
    .from('profiles')
    .select('ui_tabs')
    .eq('id', uid)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ui_tabs: (data as any)?.ui_tabs ?? null });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const payload = body?.ui_tabs ?? null;
  const { error } = await supabase
    .from('profiles')
    .update({ ui_tabs: payload })
    .eq('id', uid);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
