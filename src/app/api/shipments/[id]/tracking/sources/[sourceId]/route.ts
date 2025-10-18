import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/../utils/supabase/server';
import { randomUUID } from 'crypto';

export async function PATCH(
  req: Request,
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

  const { action, provider, identifier } = (await req
    .json()
    .catch(() => ({}))) as {
    action?: string;
    provider?: string;
    identifier?: string;
  };
  if (!action)
    return NextResponse.json({ error: 'missing action' }, { status: 400 });

  // Ensure user can access the shipment
  const { data: isPart } = await supabase.rpc('is_shipment_participant', {
    p_user: user.id,
    p_shipment: shipmentId
  });
  if (!isPart)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  if (action === 'rotate_token') {
    // Fetch current meta
    const { data: src } = await supabase
      .from('tracking_sources')
      .select('id,meta')
      .eq('id', sourceId)
      .eq('shipment_id', shipmentId)
      .single();
    const newToken = randomUUID();
    const nextMeta = { ...(src?.meta || {}), token: newToken };
    const { data, error } = await supabase
      .from('tracking_sources')
      .update({ meta: nextMeta })
      .eq('id', sourceId)
      .eq('shipment_id', shipmentId)
      .select('*')
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ source: data });
  }

  if (action === 'deactivate' || action === 'activate') {
    const active = action === 'activate';
    const { data, error } = await supabase
      .from('tracking_sources')
      .update({ active })
      .eq('id', sourceId)
      .eq('shipment_id', shipmentId)
      .select('*')
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ source: data });
  }

  if (action === 'update') {
    const updates: any = {};
    if (typeof provider === 'string') updates.provider = provider || null;
    if (typeof identifier === 'string') updates.identifier = identifier || null;
    if (!('provider' in updates) && !('identifier' in updates)) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('tracking_sources')
      .update(updates)
      .eq('id', sourceId)
      .eq('shipment_id', shipmentId)
      .select('*')
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ source: data });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
