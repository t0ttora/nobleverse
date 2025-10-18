import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import { fetchAirPosition } from '@/lib/tracking/providers/air';
import { fetchSeaPosition } from '@/lib/tracking/providers/sea';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id: shipmentId, sourceId } = await ctx.params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Ensure participant
  const { data: isPart } = await supabase.rpc('is_shipment_participant', {
    p_user: user.id,
    p_shipment: shipmentId
  });
  if (!isPart)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Load source
  const { data: src, error: srcErr } = await supabase
    .from('tracking_sources')
    .select('id, mode, source_type, identifier, provider, meta')
    .eq('id', sourceId)
    .eq('shipment_id', shipmentId)
    .single();
  if (srcErr || !src)
    return NextResponse.json({ error: 'source not found' }, { status: 404 });

  try {
    let pos: {
      lat: number;
      lon: number;
      speed?: number | null;
      heading?: number | null;
      accuracy?: number | null;
      provider?: string | null;
    };
    if (src.mode === 'air') {
      pos = await fetchAirPosition({
        identifier: src.identifier,
        provider: src.provider,
        meta: src.meta
      });
    } else if (src.mode === 'sea') {
      pos = await fetchSeaPosition({
        identifier: src.identifier,
        provider: src.provider,
        meta: src.meta
      });
    } else {
      return NextResponse.json(
        { error: 'refresh not supported for this source' },
        { status: 400 }
      );
    }

    const { error } = await supabase.rpc('track_event_write', {
      p_shipment: shipmentId,
      p_source: src.id,
      p_lat: pos.lat,
      p_lon: pos.lon,
      p_speed: pos.speed ?? null,
      p_heading: pos.heading ?? null,
      p_accuracy: pos.accuracy ?? null,
      p_provider: pos.provider ?? src.provider ?? src.mode
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'refresh failed' },
      { status: 500 }
    );
  }
}
