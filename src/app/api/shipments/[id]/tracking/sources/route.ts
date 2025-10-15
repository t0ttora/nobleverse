import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const shipmentId = params.id;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await _req.json();
    const mode = String(body.mode || '').toLowerCase();
    const source_type = String(body.source_type || '').toLowerCase();
    const identifier = body.identifier ? String(body.identifier) : null;
    const provider = body.provider ? String(body.provider) : null;
    const meta = typeof body.meta === 'object' && body.meta ? body.meta : {};

    // Minimal validation
    if (!['road', 'air', 'sea'].includes(mode)) {
      return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
    }
    if (!source_type) {
      return NextResponse.json(
        { error: 'source_type required' },
        { status: 400 }
      );
    }

    // Authorization: must be participant
    const { data: isPart } = await supabase.rpc('is_shipment_participant', {
      p_user: uid,
      p_shipment: shipmentId
    });
    if (!isPart)
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    // For driver_app, generate a token if not provided
    let finalMeta = meta || {};
    if (source_type === 'driver_app') {
      const token = finalMeta.token || randomUUID();
      finalMeta = { ...finalMeta, token };
    }

    const { data, error } = await supabase
      .from('tracking_sources')
      .insert({
        shipment_id: shipmentId,
        mode,
        source_type,
        identifier,
        provider,
        meta: finalMeta
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, source: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const shipmentId = params.id;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('tracking_sources')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data || [] });
}
