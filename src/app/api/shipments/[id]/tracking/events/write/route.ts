import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';

// Authenticated endpoint for backoffice/provider adapters to write events for air/sea
export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => ({}));
  const source_id = String(body.source_id || '');
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const speed = body.speed != null ? Number(body.speed) : null;
  const heading = body.heading != null ? Number(body.heading) : null;
  const accuracy = body.accuracy != null ? Number(body.accuracy) : null;
  const provider = body.provider ? String(body.provider) : null;

  if (!source_id || !isFinite(lat) || !isFinite(lon)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const { error } = await supabase.rpc('track_event_write', {
    p_shipment: id,
    p_source: source_id,
    p_lat: lat,
    p_lon: lon,
    p_speed: speed,
    p_heading: heading,
    p_accuracy: accuracy,
    p_provider: provider
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
