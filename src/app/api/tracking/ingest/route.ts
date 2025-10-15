import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Public-ish ingest endpoint: expects { token, shipment_id, lat, lon, speed?, heading?, accuracy?, provider? }
// Uses anon key via server client; RPC is security definer and checks the token against tracking_sources.meta->>'token'.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || '');
    const shipment_id = String(body.shipment_id || '');
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const speed = body.speed != null ? Number(body.speed) : null;
    const heading = body.heading != null ? Number(body.heading) : null;
    const accuracy = body.accuracy != null ? Number(body.accuracy) : null;
    const provider = body.provider ? String(body.provider) : 'driver_app';

    if (!token || !shipment_id || !isFinite(lat) || !isFinite(lon)) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return [] as any;
        },
        setAll() {}
      }
    });

    const { error } = await supabase.rpc('track_event_ingest', {
      p_token: token,
      p_shipment: shipment_id,
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}
