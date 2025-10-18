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

  const { searchParams } = new URL(_req.url);
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
  const sourceId = searchParams.get('source_id');

  let query = supabase
    .from('tracking_events')
    .select('id,created_at,lat,lon,speed,heading,accuracy,provider,source_id')
    .eq('shipment_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (sourceId) {
    query = query.eq('source_id', sourceId);
  }
  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] });
}
