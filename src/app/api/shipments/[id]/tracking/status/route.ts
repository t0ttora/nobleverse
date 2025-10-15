import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('tracking_status')
    .select('*')
    .eq('shipment_id', id)
    .single();
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: data || null });
}
