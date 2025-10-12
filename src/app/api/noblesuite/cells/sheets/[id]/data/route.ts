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
    .select('id,sheet_data')
    .eq('id', id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, item: data ?? null });
}

export async function PATCH(
  req: Request,
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
  const body = await req.json().catch(() => ({}));
  const { sheet_data } = body as { sheet_data: any };
  if (sheet_data == null || typeof sheet_data !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'INVALID_PAYLOAD' },
      { status: 400 }
    );
  }
  const { data, error } = await supabase
    .from('sheets')
    .update({ sheet_data })
    .eq('id', id)
    .select('id')
    .single();
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, item: data });
}
